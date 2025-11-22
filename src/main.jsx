import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BetsProvider } from "./context/BetsContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
<BrowserRouter>
  <BetsProvider>
    <App />
  </BetsProvider>
</BrowserRouter>

);
