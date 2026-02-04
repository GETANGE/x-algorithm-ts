# Start both services
echo "🚀 Starting X Algorithm Services..."

# Start Phoenix ML service in background
echo "📊 Starting Phoenix ML service on port 8001..."
cd phoenix
python main.py &
PHOENIX_PID=$!
cd ..

# Wait for Phoenix to start
sleep 3

# Start Home Mixer service
echo "🏠 Starting Home Mixer service on port 3000..."
npm run dev &
MIXER_PID=$!

echo "✅ Services started!"
echo "📊 Phoenix ML: http://localhost:8001/health"
echo "🏠 Home Mixer: http://localhost:3000/health"
echo "🔥 For You Feed: POST http://localhost:3000/scored-posts"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo '🛑 Stopping services...'; kill $PHOENIX_PID $MIXER_PID; exit" INT
wait
