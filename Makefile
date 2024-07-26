setup:
	@if ! command -v pm2 &> /dev/null; then \
		echo "pm2 not found, installing..."; \
		npm install -g pm2; \
	else \
		echo "pm2 is already installed"; \
	fi

run: setup
	PORT=$(PORT) pm2 start --name scratchpad --env PORT="${PORT}" index.js

cleanup:
	pm2 delete berater

restart:
	pm2 restart scratchpad && pm2 logs scratchpad
