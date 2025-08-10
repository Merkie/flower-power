// src/App.tsx

import { Canvas } from "./components/Canvas";
import { Draggable } from "./components/Draggable";
import { InteractiveCard } from "./components/InteractiveCard";

function App() {
  return (
    <Canvas
      options={{
        bounciness: "rigid", // Try 'rigid' or 'fluid'
        worldSize: { width: 4000, height: 4000 },
        backgroundImage: {
          src: "/background.png",
          size: 800,
        },
      }}
      world={({ movement }) => (
        <>
          {/* A simple, non-interactive element */}
          <div
            class="absolute w-[300px] h-[300px] bg-red-500/80 rounded-full shadow-lg"
            style={{
              transform: `translate(-50%, -50%)`,
              left: `0px`,
              top: `0px`,
            }}
          />

          {/* An interactive, draggable element */}
          <Draggable movement={movement} initialPos={{ x: -300, y: -200 }} />

          {/* A static element with clickable inputs */}
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
