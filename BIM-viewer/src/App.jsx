import { onMount } from "solid-js";
import World from "./World";
import "./App.css";


export default function App() {
  onMount(() => {
  });

//возвращаем страницу 

return (
  <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
    <div id="container" style={{ width: "100%", height: "100%" }}></div>
    <World />
  </div>
);
}
