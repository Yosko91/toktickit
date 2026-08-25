import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { RequesterProvider } from "./context/RequesterContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RequesterProvider>
        <App />
      </RequesterProvider>
    </BrowserRouter>
  </React.StrictMode>
);
