import { Canvas } from "./components/Canvas";
import { Draggable } from "./components/Draggable";
import { InteractiveCard } from "./components/InteractiveCard";

function App() {
  return (
    <Canvas
      options={{
        worldSize: { width: 10000, height: 10000 },
        backgroundImage: {
          src: "/background.png",
          size: 800,
        },
      }}
      world={({ movement }) => (
        <>
          <div class="w-[50px] h-[50px] absolute left-0 top-0">
            <div class="w-[1px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[50px] bg-black"></div>
            <div class="w-[50px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[1px] bg-black"></div>
            <p class="absolute right-0 top-0">0,0</p>
          </div>
          <Draggable movement={movement} initialPos={{ x: -300, y: -200 }} />
          <InteractiveCard />
        </>
      )}
      hud={({ movement }) => (
        <div class="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            data-interactive
            onClick={movement.zoomIn}
            class="w-10 h-10 bg-white grid place-items-center rounded-full border-2 font-bold text-lg shadow-md hover:bg-gray-50 active:scale-95 transition-transform"
          >
            +
          </button>
          <button
            data-interactive
            onClick={movement.zoomOut}
            class="w-10 h-10 bg-white grid place-items-center rounded-full border-2 font-bold text-lg shadow-md hover:bg-gray-50 active:scale-95 transition-transform"
          >
            -
          </button>
        </div>
      )}
    />
  );
}

export default App;
