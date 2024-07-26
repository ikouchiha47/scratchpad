const express = require('express');
const http = require('http');
const auth = require('./auth');
const scractes = require("./data");

const socketIo = require('socket.io');
const bonjour = require('bonjour')();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let scratchpadContents = [];

// discovered by mdns
let peers = new Map();

// discovered on single network
// let devices = new Set();

app.use(express.static('public'));

app.get('/devices', (req, res) => {
	let allDevices = new Set(auth.devices().filter(d => d && d.authzed));

	// console.log(allDevices, auth.devices());

	for (let peerDevices of peers.values()) {
		for (let device of peerDevices) {
			if (device && device.authzed)
				allDevices.add(device);
		}
	}

	res.json([...allDevices]);
});

app.get('/scratchpad', (req, res) => {
	res.json({ content: scratchpadContents });
});

bonjour.find({ type: 'http' }, (service) => {
	if (!peers.has(service.name)) {
		peers.set(service.name, new Set());
	}
	// get the other devices form the api?
	// io.emit('newDevice', service);
});


// Two things:
// First:
// Need to validate a user with authentication code
// So assign the socket_id: { auth_code: '', authzed: true/false, user_name: }
// Second:
// Break down updateDevices into
// flushData (on new connection)
// upsertData 
// Third:
// Also handle position changes of components
// So, socket_id: {data: []}
// Each data would be, { type, top, left, content, fabricStuff: {} }

const removeObjAttribute = (obj, key) => {
	let _copy = { ...obj }
	delete _copy[key]
	return _copy;
}

const FishtownHookers = {
	__socket: null,

	init: function(socket) {
		this.__socket = socket;
		return this;
	},

	initiateShip: function() {
		console.log("intiateShip")

		return { stage: 'init_auth', id: this.__socket.id }
	},

	validateAuth: function(response) {
		// console.log(({}).toString.call(null, this), this.__socket.id);
		try {
			console.log("validateAuth");

			let [isAuth, tokenObj] = auth.authorize(response.userName, response.authToken)
			if (tokenObj.id != this.__socket.id) {
				console.log("rehydrate", response.userName);

				console.log("debug", auth.debug())
				auth.rehydrate(tokenObj.id, this.__socket.id, response.userName);
			}
			let user = auth.find(this.__socket.id);

			sendVerificationEvent(this.__socket, user);
		} catch (e) {
			console.warn("fffailed to authorize ", e)
			this.__socket.emit('newConnection', this.openPortal());
		}
	},

	openPortal: function() {
		try {
			console.log("openPortal")
			let res = auth.init(this.__socket.id)

			console.log("auth code: ", res.authCode);

			return { stage: 'auth_pending' }
		} catch (e) {
			console.error("failed to get new connection", e);
			return { error: 'shit_went_south' }
		}
	},

	handleIdentity: function(response, onComplete, onError) {
		try {

			console.log("handleIdentity", response, this.__socket.id, auth.debug());

			let { authCode } = response;
			let user = auth.verify(this.__socket.id, authCode);

			onComplete(this.__socket, user);

		} catch (e) {
			if (e.message == 'dead') {
				console.error("failed verification", e);
				onError(this.__socket, { error: 'fuck_off' })
			}

			console.error("identity failed", e)
			console.warn('too many people on boat')

			onError(this.__socket, { error: 'overcrowded' })
		}
	},
}


const sendVerificationEvent = (sock, userData) => {
	console.log("sendVerification");

	let response = { data: removeObjAttribute(userData, 'authCode') }
	let devices = [...auth.devices()]

	// probably call authorize here, to authorize new users

	console.log("sendv", auth.debug())

	if (devices.findIndex(dev => dev.id == response.data.id) < 0) {
		devices.push(response.data)
	}

	sock.emit('comeIn', response);
	sock.emit('updateDevices', devices);
	sock.broadcast.emit('dingDing', response);

	sock.emit('flushAll', scractes.all());
}

const sendError = (sock, error) => {
	sock.emit('error', { error: error })
}

io.on('connection', (socket) => {
	console.log("new connection", socket.id)

	const fo = Object.create(FishtownHookers)
	const lifecycle = fo.init(socket);

	socket.emit('initiateShip', lifecycle.initiateShip())
	socket.on('validateAuth', lifecycle.validateAuth.bind(lifecycle))

	// handleIdentity
	socket.on('knockKnock', (response) => {
		console.log("knockKnock", response.id, socket.id);

		lifecycle.handleIdentity(response, sendVerificationEvent, sendError)
	});

	socket.on('updateScratchpad', (request) => {
		try {
			let id = request.id;
			//TODO: validate id with socket.id
			// console.log("id matchers", id, request, socket.id, auth.devices());

			let isAuthzed = auth.isAuthz(socket.id)
			// console.log("isAuthz", isAuthzed)
			if (!isAuthzed) return { error: 'unauthorized' }

			console.log("creating");
			scractes.create(id, request)

			// console.log("id matchers2", id, socket.id, scractes.all(), auth.devices());
			socket.broadcast.emit('broadcastScratche', [request]);

		} catch (e) {
			if (e.message == 'unauthorized') {
				console.error("Failed to find id", e);
				socket.emit('error', { error: 'unauthorized' })
			} else {
				console.error('update scratchpad error:', e)
			}
		}

		// validate types
		// scratchpadContents.push(content);
		// make sure not to send the update to the
		// producer of the content
		// io.emit('updateScratchpad', content);
	});

	// Handle client disconnection
	socket.on('disconnect', () => {
		try {
			auth.deregister(socket.id);
			// devices.delete(socket.id);
			// io.emit('updateDevices', Array.from(devices));
			console.log('Client disconnected', socket.id, "updating devices", auth.devices());
			socket.broadcast.emit('updateDevices', auth.devices());
		} catch (e) {
			console.error("Error disconnecting", e)
		}
	});
});

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, HOST, () => {
	console.log(`Server is running on http://${HOST}:${PORT}`);
	bonjour.publish({ name: 'Scratchpad', type: 'http', port: PORT });
});

