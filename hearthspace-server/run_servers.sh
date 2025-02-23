#!/bin/bash

# Define log files
SD_LOG="sd-webui.log"
LLAMA_SERVER_LOG="llama-server.log"
NODE_LOG="node-server.log"

# Function to run a command with logs written only to a file (no console output)
run_silent() {
    local log_file="$1"
    shift
    "$@" > "$log_file" 2>&1 &
    echo $! # Return the process ID (PID)
}

run_with_logging() {
    local log_file="$1"
    shift
    # Force line buffering with stdbuf and then tee the output both to the log file and to /dev/tty
    stdbuf -oL -eL "$@" 2>&1 | tee -a "$log_file" | tee /dev/tty &
    echo $!  # Return the process ID (PID)
}

# Function to run a command with logs written to both file and console
run_with_logging_orig() {
    local log_file="$1"
    shift
    "$@" 2>&1 | tee -a "$log_file" &
    echo $! # Return the process ID (PID)
}

# Start Stable Diffusion WebUI (log file only, no console output)
echo "Starting Stable Diffusion WebUI..."
cd ./stable-diffusion-webui
SD_PID=$(run_silent "../logs/$SD_LOG" ./webui.sh --skip-torch-cuda-test --api --listen)
echo "Stable Diffusion WebUI started with PID: $SD_PID"


# Start llama-server (log file only, no console output)
echo "Starting llama.cpp Server..."
cd ..
LLAMA_SERVER_PID=$(run_silent "./logs/$LLAMA_SERVER_LOG" ./llama.cpp/build/bin/llama-server -hf bartowski/Mistral-7B-Instruct-v0.3-GGUF)
echo "Stable Diffusion WebUI started with PID: $LLAMA_SERVER_PID"

# Wait for Stable Diffusion WebUI API to be ready
echo "Waiting for Stable Diffusion API to be available..."
while ! curl -s http://127.0.0.1:7860/sdapi/v1/txt2img > /dev/null; do
    sleep 5
    echo "Still waiting..."
done
echo "Stable Diffusion API is ready!"

# Start Node.js server (log file + console output)
echo "Starting Node.js server..."
cd .
NODE_PID=$(run_with_logging "./logs/$NODE_LOG" node server.js)
echo "Node.js server started with PID: $NODE_PID"

# Handle shutdown on script exit
trap "echo 'Stopping servers...'; kill $SD_PID $NODE_PID $LLAMA_SERVER_PID; exit" SIGINT SIGTERM

# Keep the script running until manually stopped
wait
