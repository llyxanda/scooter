import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { AiFillBulb } from "react-icons/ai";
import "./App.css";
import { useParams } from "react-router-dom";

const socket = io("http://localhost:8585");


function Scooter() {
  const { scooter } = useParams();
  const intervalRef = useRef(null);

  const [scooterId, setScooterId] = useState(scooter);
  const [email, setEmail] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [status, setStatus] = useState("Waiting for data...");
  const [isTracking, setIsTracking] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  const [battery, setBattery] = useState(null);
  const [isParked, setIsParked] = useState(false);
  const [direction, setDirection] = useState("N"); 
  const [warning, setWarning] = useState("");
  const [scooterStatus, setScooterStatus ] = useState("");


  const emitLocation = () => {
    if (scooterId && email && scooterStatus !== "charging" && scooterStatus) {
      console.log('Emiting moving', scooterId, {latitude, longitude}, scooterStatus)
      socket.emit("moving", { scooterId, current_location: { lat: latitude, lon: longitude }, email });
      setStatus(`Sent location: Latitude: ${latitude}, Longitude: ${longitude}`);
    }
  };
  

  useEffect(() => {
    if (scooter) setScooterId(scooter);
  }, [scooter]);

  useEffect(() => {
    if (isTracking) {
      const id = setInterval(() => {
        if (speed > 0) moveScooter();
        else clearInterval(intervalRef.current);
      }, 3000);
      intervalRef.current = id;
      setIntervalId(id);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTracking]);

  useEffect(() => {

    socket.on("scooterJoined", (data) => {
      console.log('scooterJoined')
      console.log('Data: ', data, socket.id, scooterId)
      if (data.scooterId === String(scooterId)) {
        console.log('connected', data.scooterId, String(scooterId), data.status)
        //setScooterId(data.scooterId);
        setEmail(data.email);
        setLongitude(data.current_location.coordinates[0]);
        setLatitude(data.current_location.coordinates[1]);
        setBattery(data.battery_level);
        setScooterStatus(data.currentstatus);
        //setAtStation(data.at_station);
        setStatus(`User ${socket.id}: (Email: ${data.email}) joined scooter ${data.scooterId}`)
  
        if (scooterStatus === "charging") {
          
          setWarning("⚠️ The scooter is charging, you can't use it.");
          setIsParked(true);
        } else {
          setWarning("");
          setIsParked(false);
        }
      }
    });
    return () => socket.off("scooterJoined");
  }, [scooterId]);

;

  useEffect(() => {
    if (scooterId) emitLocation();
  }, [latitude, longitude]);

  useEffect(() => {
    if (!scooterId || !email || !battery || !isTracking) return;
    socket.emit("batterychange", { scooterId, battery });
  }, [scooterId, email, battery, isTracking]);

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


  useEffect(() => {
    if (scooterId) {
        socket.emit("joinScooter", { type: "scooter", scooterId });
    }

    return () => {
        if (scooterId) {
            socket.emit("leaveScooter", { type: "scooter", scooterId });
        }
    };
  }, [scooterId]);


  const handleStartTracking = () => {
    if (isParked) return;
    setIsTracking(true);
    setStatus(`Started trip with scooter ${scooterId}`);
  };

  const handleSpeed = (adjustedSpeed) => {
  
    setSpeed(adjustedSpeed);
    socket.emit("speedchange", { scooterId, speed: adjustedSpeed });

  };

  useEffect(() => {
    socket.on("receivechangingspeed", (speed) => {
      console.log(`Received updated speed: ${speed}`);

      handleSpeed(speed);

    });

    return () => {
      socket.off("receivechangingspeed");
    };
  }, []);

  const moveScooter = () => {
    console.log('here:', isTracking, scooterId, speed, scooterStatus)
    if (!isTracking || !scooterId || speed <= 0 || scooterStatus === "charging") return;
    const deltaDistance = (speed * 1000) / 3600;
    const earthRadius = 6371000;
    const deltaLatitude = (deltaDistance / earthRadius) * (180 / Math.PI);
    const deltaLongitude = (deltaDistance / (earthRadius * Math.cos((latitude * Math.PI) / 180))) * (180 / Math.PI);

    setLatitude((prevLat) => prevLat + (direction === "N" ? deltaLatitude : direction === "S" ? -deltaLatitude : 0));
    setLongitude((prevLon) => prevLon + (direction === "E" ? deltaLongitude : direction === "W" ? -deltaLongitude : 0));

    const batteryDrain = (speed * 0.001) + 0.01;
    setBattery((prevBattery) => Math.max(0, prevBattery - batteryDrain));

    if (battery - batteryDrain <= 20) {
      setWarning("⚠️ Low battery!  Consider choosing another scooter.");
    }

    if (battery - batteryDrain <= 0) {
      handleStopTracking();
      setStatus("⚠️ Battery empty! Scooter stopped.");
    }
  };

  const handleStopTracking = () => {
    setIsTracking(false);
    setStatus("Scooter stopped.");
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handlePark = () => {
    setIsTracking(false);
    setIsParked(true);
    setStatus("Scooter parked.");
    socket.emit("endTrip", { scooterId, email, current_location: { lat: latitude, lon: longitude }, battery  });
  };

  const handleCharge = () => {
    if (!scooterId) return;
    socket.emit("charging", { scooterId });
  };

  return (
    <div className="container">
      <h3>Scooter ID:</h3>
      <h2>{scooterId}</h2>

      <p><strong>Latitude:</strong> {latitude?.toFixed(5)}</p>
      <p><strong>Longitude:</strong> {longitude?.toFixed(5)}</p>
  
      <p style={{ color: battery < 20 ? "red" : "black", display: "flex", alignItems: "center", gap: "5px" }}>
        <AiFillBulb size={24} color={battery < 20 ? "red" : "green"} />
        <strong>Battery:</strong> {battery?.toFixed(2)}%
      </p>

      <p style={{ 
                  color: scooterStatus === "charging" ? "red" : "green", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "5px" 
                }}>
          <AiFillBulb size={24} color={scooterStatus === "charging" ? "red" : "green"} />
          <strong>charging:</strong> {scooterStatus === "charging" ? "Yes" : "No"}
        </p>

      
      <label>Speed (km/h):</label>
      <input type="number" id="speed-input" value={speed} step="any" onChange={(e) => handleSpeed(parseFloat(e.target.value))} />
      <label>Direction:</label>
      <select id="select" value={direction} onChange={(e) => setDirection(e.target.value)}>
        <option value="N">North</option>
        <option value="S">South</option>
        <option value="E">East</option>
        <option value="W">West</option>
      </select>
  
      <div className="control-buttons">
        <button id="startButton" onClick={handleStartTracking} disabled={isTracking || isParked || scooterStatus === "charging"} className="start-button">Start</button>
        <button id="stopButton" onClick={handleStopTracking} disabled={!isTracking}>Stop</button>
        <button id="parkButton" onClick={handlePark} disabled={isTracking}>Park</button>
      </div>

      <div>        
        <button onClick={handleCharge} disabled={scooterStatus === "charging" || isTracking} className="charge-button">
          {scooterStatus === "charging" ? "Charging..." : "Charge"}
        </button>
      </div>

  
      <h3>Status:</h3>
      <h3> {warning} </h3>
      <pre>{status}</pre>
    </div>
  );
  
}

export default Scooter;
