import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import "./App.css";
import { getDistance } from 'geolib';

// Connect to the backend socket
const socket = io("http://localhost:8585");

function App() {
  const [scooterId, setScooterId] = useState("");
  const [email, setEmail] = useState("");
  const [latitude, setLatitude] = useState(59.3293);
  const [longitude, setLongitude] = useState(18.0686);
  const [speed, setSpeed] = useState(0);
  const [status, setStatus] = useState("Waiting for data...");
  const [isTracking, setIsTracking] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [battery, setBattery] = useState(70);
  const [lastSpeedChangeTime, setLastSpeedChangeTime] = useState(null);
  const [totalWeightedSpeed, setTotalWeightedSpeed] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);


  useEffect(() => {
    socket.on("scooterJoined", (data) => {
      console.log("Received scooterJoined event data:", data);
      if (data) {
        setScooterId(data.scooterId);
        setEmail(data.email);
        console.log("State updated: ", {
          scooterId: data.scooterId,
          email: data.email,
        });
      }
    });
  
    return () => {
      socket.off("scooterJoined");
    };
  }, []);
  
  
  useEffect(() => {
    if (scooterId && !isNaN(speed)) {
      handleSendSpeed();
    }
  }, [speed]);
  
  useEffect(() => {
    if (scooterId && !isNaN(battery)) {
      handleSendBattery();
    }
  }, [battery]);


  useEffect(() => {
    if (scooterId && !isNaN(latitude)) {
      emitLocation();
    }
  }, [latitude]);
  
  useEffect(() => {
    if (scooterId && !isNaN(longitude)) {
      emitLocation();
    }
  }, [longitude]);

  /*// Handle joining the scooter
  const handleJoinScooter = () => {
    if (scooterId && email) {
      socket.emit("joinScooter", { scooterId, email, current_location:{ lat: latitude, lon: longitude } });
      setStatus(`Joined scooter ${scooterId} as ${email}`);
    } else {
      alert("Please enter both Scooter ID and Email.");
    }
  };*/

  const emitLocation = () => {
    console.log("Emit Location Check:", { scooterId, email, latitude, longitude });
    if (scooterId && email && !isNaN(latitude) && !isNaN(longitude)) {
      const location = { lat: latitude, lon: longitude };
      socket.emit("moving", { scooterId, current_location: location, email });
      setStatus(`Sent location: Latitude: ${latitude}, Longitude: ${longitude}`);
    } else {
      alert("Please ensure that all fields are filled in correctly.");
    }
  };


  const handleSendSpeed = () => {
    const currentTime = Date.now();
  
    if (lastSpeedChangeTime) {
      const elapsedTime = (currentTime - lastSpeedChangeTime) / 1000; // Convert ms to seconds
      setTotalWeightedSpeed(
        (prev) => prev + speed * elapsedTime
      );
      setTotalTime((prev) => prev + elapsedTime);
    }
    
    setLastSpeedChangeTime(currentTime);
  
    socket.emit("speedchange", { scooterId, speed });
    setStatus(`Sent speed: ${speed} km/h. ${totalTime}. ${totalWeightedSpeed}. ${lastSpeedChangeTime}`);
  };
  

  // Handle sending speed to the server
  const handleSendBattery = () => {
      if (scooterId && !isNaN(battery)) {
        socket.emit("batterychange", { scooterId, battery });
        setStatus(`Sent batery: ${battery} %`);
      } else {
        alert("Please ensure the speed is a valid number.");
      }
    };

  // Start tracking the scooter
  const handleStartTracking = () => {
    setIsTracking(true);
    setStatus(`Started trip with scooter ${scooterId} as ${email}`);
    emitLocation();
    setStartTime(Date.now());
  };

  // Stop tracking the scooter
  const handleStopTracking = () => {
    setIsTracking(false);
    setStatus("Scooter stopped.");

    const avgSpeed = totalTime > 0 ? totalWeightedSpeed / totalTime : 0;
    setAvgSpeed(avgSpeed);
    setStatus(`Trip ended. Average Speed: ${avgSpeed.toFixed(2)} km/h`);

    // Clear the interval if it exists
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  };

  // Handle parking the scooter (same as stopping)
  const handlePark = () => {
    setIsTracking(false);
    setStatus("Scooter parked.");
    const location = { lat: latitude, lon: longitude };
    const endTime = Date.now();
    const cost = (endTime - startTime) / (1000 * 60)*20;
    socket.emit("endTrip", { scooterId, email, current_location:location, avg_speed: avgSpeed, cost: cost });
    //Dissconect the user

    // Clear the interval if it exists
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null); // Reset the interval ID
    }
  };

  socket.on("receivechangingspeed", (speed) => {
    setStatus(`Scooter speed updated: ${speed} km/h`);
    setSpeed(speed)
  });

  return (
    <div className="container">

      <h3>Move the Scooter</h3>
      <label htmlFor="latitude">Latitude:</label>
      <input
        type="number"
        id="latitude"
        value={latitude}
        step="any"
        onChange={(e) => {setLatitude(parseFloat(e.target.value));
          if (isTracking) {
            emitLocation();
          }
        }}
      />
      <br />
      <label htmlFor="longitude">Longitude:</label>
      <input
        type="number"
        id="longitude"
        value={longitude}
        step="any"
        onChange={(e) => {setLongitude(parseFloat(e.target.value));
          if (isTracking) {
            emitLocation();
          }
        }}
      />
      <br />
      <label htmlFor="speed">Speed (km/h):</label>
      <input
        type="number"
        id="speed"
        value={speed}
        step="any"
        onChange={(e) => setSpeed(parseFloat(e.target.value))}
      />
      <br />
      <label htmlFor="battery">Battery:</label>
      <input
        type="number"
        id="battery"
        value={battery}
        step="any"
        onChange={(e) => setBattery(parseFloat(e.target.value))}
      />

      <div className="control-buttons">
        <button onClick={handleStartTracking} disabled={isTracking} className="start-button">
          Start
        </button>
        <button onClick={handleStopTracking} disabled={!isTracking} className="stop-button">
          Stop
        </button>
        <button onClick={handlePark} disabled={isTracking} className="park-button">Park</button>
      </div>

      <h3>Status:</h3>
      <pre>{status}</pre>

    </div>
  );
}

export default App;
