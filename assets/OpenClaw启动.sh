#!/bin/bash
export LANG=en_US.UTF-8
echo "============================================"
echo "  OpenClaw Gateway Launcher"
echo "  AILKXQ"
echo "============================================"
echo ""
cd ~/.openclaw
echo "Starting OpenClaw gateway on port 18789..."
echo ""
openclaw gateway
echo ""
echo "Gateway process exited. Press any key to close..."
read -n 1 -s
