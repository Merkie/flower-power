// src/components/InteractiveCard.tsx

export const InteractiveCard = () => {
  return (
    <div
      // This attribute prevents canvas panning when interacting with this card
      data-interactive
      class="absolute p-4 bg-white rounded-lg shadow-lg"
      style={{ top: "200px", left: "300px", width: "220px" }}
    >
      <h3 class="font-bold text-gray-800">Static Card</h3>
      <p class="text-sm text-gray-600 my-1">
        You can click and type here without panning the canvas.
      </p>
      <input
        type="text"
        placeholder="Type here..."
        class="w-full border rounded p-1 mt-1 text-sm"
      />
      <button
        class="w-full bg-blue-500 text-white p-1 rounded mt-2 text-sm hover:bg-blue-600"
        onClick={() => alert("Button Clicked!")}
      >
        Test Click
      </button>
    </div>
  );
};
