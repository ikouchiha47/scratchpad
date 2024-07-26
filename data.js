let store = {};

let ScratchTypes = {
	text: true,
	image: true,
}

const ScratchPad = {
	__validatePresence: (id) => {
		if (!(id in store)) {
			throw Error('unauthorized')
		}
	},

	__validateScratchType: (content) => {
		if (!content) throw Error('empty_content')
		if (!content.type) throw Error('invalid_data')

		if (!(content.type in ScratchTypes)) {
			throw Error('invalid_type')
		}
		return true;
	},

	create: function(id, data) {
		this.__validateScratchType(data)

		if (!store[id]) {
			store[id] = []
		}

		store[id].push(data)
		return this
	},

	all: () => Object.keys(store).flatMap(id => store[id] || []),

	find: (id) => {
		this.__validatePresence(id);
		return store[id]
	}
}

module.export = ScratchTypes

module.exports = ScratchPad;
