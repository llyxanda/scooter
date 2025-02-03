import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Scooter from "./Scooter.js";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/:scooter" element={<Scooter />} />
      </Routes>
    </Router>
  );
}

export default App;
