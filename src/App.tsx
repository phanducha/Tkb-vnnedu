import TKBProcessor from "./component/tkbProcessor";

function App() {
  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-indigo-100 via-white to-blue-100" style={{ width: "100vw" }}>
      <div className="max-w-5xl px-8 py-10">
        <div className="bg-white/90 shadow-2xl rounded-3xl p-10 border border-gray-100">
          <TKBProcessor />
        </div>
      </div>
    </div>
  );
}

export default App;
