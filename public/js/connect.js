(function() {
	function $(el, ctx) {
		return document.querySelector(el)
	}

	function $$(el, ctx) {
		return document.querySelectorAll(el)
	}

	let selectedObject = null;
	let canvas = null;
	let lastLeft = 50;
	let lastTop = 50;
	let itemSpacing = 30; // Distance between items

	const themes = {
		dark: { bgColor: '#000', fgColor: '#fff' },
		bright: { bgColor: 'rgb(249, 245, 242)', fgColor: '#000' },
	}

	let currentTheme = localStorage.getItem('_scratchpad_theme_') || 'bright';
	let isDragging = false;
	let dragStartX, dragStartY;

	let isPanning = false;
	let lastPosX = 0;
	let lastPosY = 0;


	function adjustCanvasSize(newItem) {
		let canvasWidth = canvas.getWidth();
		let canvasHeight = canvas.getHeight();

		// console.log(newItem.width, newItem.left, canvasWidth);
		if (!newItem) { return; }

		if (newItem.left + newItem.width > canvasWidth) {
			canvas.setWidth(newItem.left + newItem.width + 50); // Add some extra space
		}

		if (newItem.top + newItem.height > canvasHeight) {
			canvas.setHeight(newItem.top + newItem.height + 50); // Add some extra space
		}

		canvas.renderAll();
	}

	// get distance between two fingers
	function getDistance(touch1, touch2) {
		const dx = touch1.clientX - touch2.clientX;
		const dy = touch1.clientY - touch2.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	function initCanvas() {
		canvas = new fabric.Canvas('canvas', {
			width: window.innerWidth * 0.8,
			height: window.innerHeight * 0.65,
			backgroundColor: themes[currentTheme].bgColor,
			// enablePointerEvents: true,
		});

		canvas.on('selection:created', (e) => {
			selectedObject = e.selected[0];
		});

		let longPressTimer;
		let isCopying = false;

		canvas.on('mouse:down', (e) => {
			// console.log(e.target.type == 'i-text', "tits");
			if (e.target && e.target.type == 'i-text') {
				longPressTimer = setTimeout(() => {
					isCopying = true && !isDragging;
					console.log("drag, copy", isDragging, isCopying);

					copyTextToClipboard(e.target.text);
					alert('Text copied!');
				}, 1000);
			}

			isDragging = true;

			let evt = e.e;
			isPanning = evt.altKey === true;

			lastPosX = evt.clientX;
			lastPosY = evt.clientY;
			dragStartX = lastPosX;
			dragStartY = lastPosY;

			// console.log(selectedObject, "sc");
			adjustCanvasSize(selectedObject)
		});

		canvas.on('mouse:up', () => {
			isPanning = false;
			isDragging = false;

			canvas.selection = true;

			clearTimeout(longPressTimer);
			setTimeout(() => {
				isCopying = false;
			}, 100);
		});

		canvas.on('mouse:move', (opt) => {
			// console.log(opt.target, isDragging, "target");
			let e = opt.e;

			if (isPanning) {
				let vpt = canvas.viewportTransform;
				vpt[4] += e.clientX - lastPosX;
				vpt[5] += e.clientY - lastPosY;
				canvas.requestRenderAll();
				lastPosX = e.clientX;
				lastPosY = e.clientY;
				return;
			}

			// Only on desktop
			// TODO merge this with touchmove
			if (isDragging && !opt.target && !e.touches) {
				let vpt = canvas.viewportTransform;
				// console.log("b4r", vpt, lastPosY, lastPosX, e.clientX, e.clientY);
				vpt[4] += e.clientX - lastPosX;
				vpt[5] += e.clientY - lastPosY;

				// console.log("a8r", vpt)
				canvas.requestRenderAll();
				lastPosX = e.clientX;
				lastPosY = e.clientY;
			} else if (isDragging && opt.target) {
				isDragging = false;
			}
		});

		canvas.on('mouse:wheel', (opt) => {
			let delta = opt.e.deltaY;
			let zoom = canvas.getZoom();
			zoom = zoom + delta / 200;
			if (zoom > 3) zoom = 3;
			if (zoom < 0.5) zoom = 0.5;
			canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
			opt.e.preventDefault();
			opt.e.stopPropagation();
		});


		let lastDistance = 0;

		canvas.wrapperEl.addEventListener('touchstart', (e) => {
			if (e.touches.length === 1) {
				isDragging = true;
				lastPosX = e.touches[0].clientX;
				lastPosY = e.touches[0].clientY;
			} else if (e.touches.length === 2) {
				isDragging = false
				lastDistance = getDistance(e.touches[0], e.touches[1]);
			}
		});

		canvas.wrapperEl.addEventListener('touchend', (e) => {
			isDragging = false;
			isPanning = false;
		});

		// Todo: unify this with mouse:move
		canvas.wrapperEl.addEventListener('touchmove', (e) => {
			if (isDragging && e.touches.length === 1) {

				let touch = e.touches[0];
				let vpt = canvas.viewportTransform;
				vpt[4] += touch.clientX - lastPosX;
				vpt[5] += touch.clientY - lastPosY;
				canvas.requestRenderAll();
				lastPosX = touch.clientX;
				lastPosY = touch.clientY;
				e.preventDefault();
			} else if (e.touches.length === 2) {
				const distance = getDistance(e.touches[0], e.touches[1]);
				// if delta < 0, fingers are moving towards, lastDistance > nowDistance
				// if distance increases, delta > 0

				const delta = distance - lastDistance;
				let zoom = canvas.getZoom();
				zoom = zoom * (1 + delta / 200);
				if (zoom > 3) zoom = 3;
				if (zoom < 0.5) zoom = 0.5;

				// midpoint of two fingers
				const center = {
					x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
					y: (e.touches[0].clientY + e.touches[1].clientY) / 2
				};

				const canvasOffset = canvas.wrapperEl.getBoundingClientRect();
				const zoomPoint = {
					x: center.x - canvasOffset.left,
					y: center.y - canvasOffset.top
				};

				canvas.zoomToPoint(new fabric.Point(zoomPoint.x, zoomPoint.y), zoom);
				lastDistance = distance;
				e.preventDefault();
			}
		});
	}

	const deviceList = document.getElementById('device-list');

	function renderDevices(devices) {
		let html = devices.map(device => `<li data-id="${device.id}">${device.userName}</li>`).join('');
		console.log(html, "html")
		deviceList.innerHTML = html;
	}

	function renderNewDevice(device) {
		let li = document.createElement("li")
		li.dataset.id = device.id;
		li.innerText = device.userName;

		deviceList.appendChild(li);
	}

	function makeItemForTransport(id, type, rest) {
		return { id: id, type: type, rest: rest }
	}

	function fromItemForTransport(data) {
		return [data.id, data.type, data.content, data.left, data.top];
	}

	function toss(options) {
		let choice = Math.floor(Math.random() * options.length) % options.lenth;
		return options[choice]
	}

	function createItem(type, content, left, top) {
		console.log("creating item")

		let fabricObject;
		let obj = {};

		if (type === 'text') {
			obj = {
				type: 'text',
				content: content,
				left: left,
				top: top,
				fontSize: 22,
				fill: themes[currentTheme].fgColor,
				fontFamily: 'Quicksand',
				hasControls: false,
			}

			fabricObject = new fabric.IText(content, {
				left: left,
				top: top,
				fontSize: 22,
				fill: themes[currentTheme].fgColor,
				fontFamily: 'Quicksand',
				hasControls: false,
			});

			// console.log("wh", fabricObject.width, fabricObject.height);

			if (toss(['left', 'top']) == 'left') {
				lastLeft = left + fabricObject.width + itemSpacing;
				lastTop = top + itemSpacing;
			} else {
				lastLeft = left + itemSpacing;
				lastTop = top + fabricObject.height + itemSpacing;
			}
		} else if (type === 'image') {
			obj = {
				type: 'image',
				content: content,
				left: left,
				top: top,
			}

			fabric.Image.fromURL(content, (img) => {
				img.scale(0.5).set({
					left: left,
					top: top
				});
				canvas.add(img);
				canvas.renderAll();

				if (toss(['left', 'top']) == 'left') {
					lastLeft = left + img.width * img.scaleX + itemSpacing;
					lastTop = top + itemSpacing;
				} else {
					lastLeft = left + itemSpacing;
					lastTop = top + img.height * img.scaleY + itemSpacing;
				}
				// Emit the new item to other clients
				// socket.emit('newItem', makeItem(type, content, left, top));
				adjustCanvasSize(fabricObject)
			});
			return;
		} else {
			return
		}
		canvas.add(fabricObject);
		canvas.renderAll();
		adjustCanvasSize(fabricObject)

		return obj;
	}

	document.addEventListener('DOMContentLoaded', () => {
		const socket = io();
		const scratchpad = $('#scratchpad');
		const status = $('#status');
		const addText = $("#addText")
		const imgUpload = $("#imageUpload");
		const textInputDialog = $("#textInputDialog");
		const authCode = $("#authCode");
		const authUserDialog = $("#authUserDialog")

		authCode.addEventListener('input', (e) => {
			let value = e.target.value;

			if (value.length == 6) {
				socket.emit('knockKnock', ({ id: socket.id, authCode: value.toUpperCase() }))

				// TODO: do this after user verified
				if (!authUserDialog.classList.contains('hidden')) {
					authUserDialog.close();
					setTimeout(() => authUserDialog.classList.add('hidden'), 500);
				}

				e.target.value = '';
			}
		})

		addText.addEventListener('click', () => {
			if (textInputDialog.classList.contains('hidden')) {
				textInputDialog.classList.remove('hidden')
				textInputDialog.showModal();
			} else {
				textInputDialog.close();
				setTimeout(() => textInputDialog.classList.add('hidden'), 500);
			}
		})

		socket.on('initiateShip', (result) => {
			if (result.stage == 'init_auth') {
				console.log('init_auth')

				let userName = localStorage.getItem('userName') || '';
				let authToken = localStorage.getItem('authToken') || '';

				socket.emit('validateAuth', { id: result.id, userName, authToken })
				return
			}
		});

		socket.on('newConnection', (result) => {
			// console.log(result);
			console.log('new_connection', result.stage)

			if ('stage' in result && result.stage == 'auth_pending') {
				authUserDialog.classList.remove('hidden');
				authUserDialog.showModal();
			}
		});

		socket.on('dingDing', (response) => {
			console.log("ding ding");
			response.data && renderNewDevice(response.data);
		})

		socket.on('flushAll', (scratches) => {
			console.log("flush all, contents", scratches);
			scratches.forEach(scratch => {
				let { id, type, content, left, top } = scratch;
				createItem(type, content, left, top)
			})
		})

		socket.on('comeIn', (response) => {
			console.log('coming', response.data)

			localStorage.setItem('userName', response.data.userName);
			localStorage.setItem('authToken', response.data.authToken)
		})

		socket.on('updateDevices', (devices) => {
			console.log('update device', devices);
			renderDevices(devices)
		})

		socket.on('broadcastScratche', (scratches) => {
			scratches.forEach(scratch => {
				let { id, type, content, left, top } = scratch;
				createItem(type, content, left, top)
			})
		});

		// socket.on('updateScratchpad', (data) => {
		// 	// scratchpad.value = content;
		// 	if (!data) return;
		//
		// 	const rendered = (response) => {
		// 		if (!response) return;
		//
		// 		let args = fromItemForTransport(response)
		// 		if (args.some(v => !!v == false) || args.length < 4) {
		// 			console.log("malformed data ", args);
		// 		}
		// 		createItem.apply(null, args);
		// 	}
		//
		// 	if (data.length && data.splice) {
		// 		data.forEach(content => {
		// 			rendered(content)
		// 		})
		// 	} else {
		// 		rendered(data)
		// 	}
		//
		// 	status.textContent = 'Content updated';
		// });

		textInputDialog.addEventListener('close', () => {
			if (textInputDialog.returnValue === 'confirm') {
				const text = scratchpad.value.trim();
				if (text) {
					let args = ['text', text, lastLeft, lastTop];
					let obj = createItem.apply(null, args);

					socket.emit('updateScratchpad', ({ ...obj, id: socket.id }));
					status.textContent = 'Text added';

				}
			}

			textInputDialog.close();
			textInputDialog.classList.add('hidden')
			scratchpad.value = ''; // Clear the input
		});

		// Fetch the initial list of devices
		// Give it a second for the server to register
		setTimeout(() => {
			fetch('/devices')
				.then(response => response.json())
				.then(data => {
					console.log('Devices:', data);
					renderDevices(data);
				})
				.catch(error => {
					console.error('Error fetching devices:', error);
				});
		}, 500);

	});

	initCanvas();
})()
