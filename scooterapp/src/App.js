import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import { AiFillBulb } from "react-icons/ai";
import "./App.css";

const socket = io("http://localhost:8585");

function App() {
  const [scooterId, setScooterId] = useState("");
  const [email, setEmail] = useState("");
  const [latitude, setLatitude] = useState(59.3293);
  const [longitude, setLongitude] = useState(18.0686);
  const [speed, setSpeed] = useState(0);
  const [status, setStatus] = useState("Waiting for data...");
  //const [speedControll, setSpeedcontroll] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  const [battery, setBattery] = useState(70);
  const [isParked, setIsParked] = useState(false);
  const [direction, setDirection] = useState("N"); 
  const [warning, setWarning] = useState("");
  const [scooterStatus, setScooterStatus] = useState("");

  useEffect(() => {
    socket.on("scooterJoined", (data) => {
      if (data) {
        setScooterId(data.scooterId);
        setEmail(data.email);
        setLongitude(data.current_location.lon);
        setLatitude(data.current_location.lat);
        setBattery(data.battery_level);
        setScooterStatus(data.status);

        if (data.status === "charging") {
          setWarning("⚠️ The scooter is charging, you can't use it.");
          setIsParked(true);
        } else {
          setWarning("");
          setIsParked(false);
        }
      }
    });

    return () => socket.off("scooterJoined");
  }, []);

  useEffect(() => {
    if (scooterId) socket.emit("batterychange", { scooterId, battery });
  }, [battery]);

  useEffect(() => {
    if (scooterId) emitLocation();
  }, [latitude, longitude]);

  useEffect(() => {

    socket.on("statusChange", ({ scooterId: updatedScooterId, status }) => {
      if (updatedScooterId === scooterId) {
        setScooterStatus(status);

        if (status === "charging") {
          setWarning("⚠️ The scooter is charging, you can't use it.");
          setIsParked(true);
        } else {
          setWarning("");
          setIsParked(false);
        }
      }
    });

    return () => socket.off("statusChange");
  }, [scooterId]);

  const emitLocation = () => {
    if (scooterId && email) {
      socket.emit("moving", { scooterId, current_location: { lat: latitude, lon: longitude }, email });
      setStatus(`Sent location: Latitude: ${latitude}, Longitude: ${longitude}`);
    }
  };

  const handleStartTracking = () => {
    if (isParked || scooterStatus === "charging") return;
    setIsTracking(true);
    setStatus(`Started trip with scooter ${scooterId}`);

    const id = setInterval(() => {
      if (speed > 0) moveScooter();
      else clearInterval(intervalId);
    }, 1000);
    setIntervalId(id);
  };

  const handleSpeed = (newSpeed) => {
    // Cap speed at 30 km/h before updating state
    const adjustedSpeed = newSpeed > 30 ? 30 : newSpeed;

    setSpeed(adjustedSpeed);
    socket.emit("speedchange", { scooterId, speed: adjustedSpeed });
    //setSpeedcontroll(`Scooter speed updated: ${adjustedSpeed} km/h`);
  };

  useEffect(() => {
    socket.on("receivechangingspeed", (speed) => {
      console.log(`Received updated speed: ${speed}`);

      setSpeed(speed);
      //setSpeedcontroll(`Scooter speed updated: ${speed} km/h`);
    });

    return () => {
      socket.off("receivechangingspeed");
    };
  }, []);

  const moveScooter = () => {
    if (!scooterId || speed <= 0 || scooterStatus === "charging") return; // Prevent movement if charging

    const deltaDistance = (speed * 1000) / 3600;
    const earthRadius = 6371000;
    const deltaLatitude = (deltaDistance / earthRadius) * (180 / Math.PI);
    const deltaLongitude = (deltaDistance / (earthRadius * Math.cos((latitude * Math.PI) / 180))) * (180 / Math.PI);

    setLatitude((prevLat) => prevLat + (direction === "N" ? deltaLatitude : direction === "S" ? -deltaLatitude : 0));
    setLongitude((prevLon) => prevLon + (direction === "E" ? deltaLongitude : direction === "W" ? -deltaLongitude : 0));

    const batteryDrain = (speed * 0.002) + 0.01; 
    setBattery((prevBattery) => Math.max(0, prevBattery - batteryDrain));

    if (battery - batteryDrain <= 20) {
      setWarning("⚠️ Low battery! Consider choosing another scooter.");
    }

    if (battery - batteryDrain <= 0) {
      handleStopTracking();
      setStatus("⚠️ Battery empty! Scooter stopped.");
    }
  };

  const handleStopTracking = () => {
    setIsTracking(false);
    setStatus("Scooter stopped.");
    if (intervalId) clearInterval(intervalId);
  };

  const handlePark = () => {
    setIsTracking(false);
    setIsParked(true);
    setStatus("Scooter parked.");
    socket.emit("endTrip", { scooterId, email, current_location: { lat: latitude, lon: longitude } });
  };

  const handleCharge = () => {
    if (!scooterId) return;
    socket.emit("charging", { scooterId });
  };

  return (
    <div className="container">
      <h3>Scooter ID:</h3>
      <h2>{scooterId}</h2>

      <p><strong>Latitude:</strong> {latitude.toFixed(5)}</p>
      <p><strong>Longitude:</strong> {longitude.toFixed(5)}</p>

      <p style={{ color: battery < 20 ? "red" : "black", display: "flex", alignItems: "center", gap: "5px" }}>
        <AiFillBulb size={24} color={battery < 20 ? "red" : "green"} />
        <strong>Battery:</strong> {battery.toFixed(2)}%
      </p>

      <p style={{ 
        color: scooterStatus === "charging" ? "red" : "green", 
        display: "flex", 
        alignItems: "center", 
        gap: "5px" 
      }}>
        <AiFillBulb size={24} color={scooterStatus === "charging" ? "red" : "green"} />
        <strong>Charging:</strong> {scooterStatus === "charging" ? "Yes ⚡" : "No"}
      </p>

      <label>Speed (km/h):</label>
      <input
        type="number"
        value={speed}
        step="any"
        onChange={(e) => handleSpeed(parseFloat(e.target.value))}
      />

      <label>Direction:</label>
      <select value={direction} onChange={(e) => setDirection(e.target.value)}>
        <option value="N">North</option>
        <option value="S">South</option>
        <option value="E">East</option>
        <option value="W">West</option>
      </select>

      <div className="control-buttons">
        <button onClick={handleStartTracking} disabled={isTracking || isParked} className="start-button">Start</button>
        <button onClick={handleStopTracking} disabled={!isTracking}>Stop</button>
        <button onClick={handlePark} disabled={isTracking}>Park</button>

      </div>
      <div>        
        <button onClick={handleCharge} disabled={scooterStatus === "charging" || isTracking} className="charge-button">
          {scooterStatus === "charging" ? "Charging..." : "Charge"}
        </button>
      </div>

      <h3>Status:</h3>
      <h3> {warning} </h3>
      <h3>{status}</h3>
    </div>
  );
}

export default App;
