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
  const [totalDistance, setTotalDistance] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [battery, setBattery] = useState(70);

  // Handle joining the scooter
  const handleJoinScooter = () => {
    if (scooterId && email) {
      socket.emit("joinScooter", { scooterId, email, current_location:{ lat: latitude, lon: longitude } });
      setStatus(`Joined scooter ${scooterId} as ${email}`);
    } else {
      alert("Please enter both Scooter ID and Email.");
    }
  };

  const emitLocation = () => {
    if (scooterId && email && !isNaN(latitude) && !isNaN(longitude)) {
      const location = { lat: latitude, lon: longitude };
      socket.emit("moving", { scooterId, current_location: location, email });
      setStatus(`Sent location: Latitude: ${latitude}, Longitude: ${longitude}`);
    } else {
      alert("Please ensure that all fields are filled in correctly.");
    }
  };


  // Handle sending speed to the server
  const handleSendSpeed = () => {
    if (scooterId && !isNaN(speed)) {
      socket.emit("speedchange", { scooterId, speed });
      setStatus(`Sent speed: ${speed} km/h`);
    } else {
      alert("Please ensure the speed is a valid number.");
    }
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
    const totalTimeInHours = (endTime - startTime) / (1000 * 60 * 60); // Convert ms to hours
    const avgSpeed = totalDistance / totalTimeInHours || 0;
    const cost = (endTime - startTime) / (1000 * 60)*20;
    socket.emit("endTrip", { scooterId, email, current_location:location, avg_speed: avgSpeed, cost: cost });
    //Send a status update to backend to set status to inactive
    //Dissconect the user

    // Clear the interval if it exists
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null); // Reset the interval ID
    }
  };

  // Update latitude and longitude based on button clicks
  const handleLeftClick = () => {
    // Move the scooter left by decreasing latitude
    const newLatitude = latitude - 0.0001 * speed;
    setLatitude(newLatitude);
    setStatus(`Moved left: Latitude = ${newLatitude}`);
    if (isTracking) {
      emitLocation(); // Emit the location whenever a direction button is pressed
    }
  };

  const handleRightClick = () => {
    // Move the scooter right by increasing latitude
    const newLatitude = latitude + 0.0001 * speed;
    setLatitude(newLatitude);
    setStatus(`Moved right: Latitude = ${newLatitude}`);
    if (isTracking) {
      emitLocation(); // Emit the location whenever a direction button is pressed
    }
  };

  const handleForwardClick = () => {
    // Move the scooter forward by increasing longitude
    const earthCircumferencePerDegree = 111.32; // Distance for 1 degree at the equator (km)
  
    // Calculate the distance covered by 1 degree of longitude at the given latitude
    const distancePerDegree = earthCircumferencePerDegree * Math.cos(latitude * (Math.PI / 180));
    
    // Calculate the change in longitude
    const longitudeChange = (speed / distancePerDegree) * 1/3600;
    const newLongitude = longitude + longitudeChange;
    setLongitude(newLongitude);
    setStatus(`Moved forward: Longitude = ${newLongitude}`);
    if (isTracking) {
      const id = setInterval(() => {
        emitLocation();
        clearInterval(id);
        setIntervalId(null);
      }, 1000);
      setIntervalId(id);
      const distance = getDistance(
        { latitude, longitude },
        { latitude, longitude: newLongitude }
      ) / 1000;
      setTotalDistance((prev) => prev + distance);
    }
  };

  const handleBackwardClick = () => {
    // Move the scooter backward by decreasing longitude
    const newLongitude = longitude - 0.001 * speed; // Adjusting by speed (0.001 per km/h)
    setLongitude(newLongitude);
    setStatus(`Moved backward: Longitude = ${newLongitude}`);
    if (isTracking) {
      emitLocation(); // Emit the location whenever a direction button is pressed
    }
  };

  socket.on("receivechangingspeed", (speed) => {
    setStatus(`Scooter speed updated: ${speed} km/h`);
    setSpeed(speed)
  });

  return (
    <div className="container">
      <h1>Scooter Tracker</h1>

      <div>
        <label htmlFor="scooterId">Scooter ID:</label>
        <input
          type="text"
          id="scooterId"
          placeholder="Enter Scooter ID"
          value={scooterId}
          onChange={(e) => setScooterId(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="email">Your Email:</label>
        <input
          type="email"
          id="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <button onClick={handleJoinScooter}>Join Scooter</button>

      <hr />

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
        onChange={(e) => {
          setSpeed(parseFloat(e.target.value));
          handleSendSpeed();
        }}
      />
      <br />
      <label htmlFor="battery">Battery:</label>
      <input
        type="number"
        id="battery"
        value={battery}
        step="any"
        onChange={(e) => {
          setBattery(parseFloat(e.target.value));
          handleSendBattery();
        }}
      />

      <div className="control-buttons">
        <button onClick={handleStartTracking} disabled={isTracking}>
          Start
        </button>
        <button onClick={handleStopTracking} disabled={!isTracking}>
          Stop
        </button>
        <button onClick={handlePark}>Park</button>
      </div>

      <h3>Status:</h3>
      <pre>{status}</pre>

      {/* Cross Layout for Controls */}
      <div className="controls">
        <div className="vertical">
          <button onClick={handleForwardClick}>Forward</button>
          <button onClick={handleBackwardClick}>Backward</button>
        </div>
        <div className="horizontal">
          <button onClick={handleLeftClick}>Left</button>
          <button onClick={handleRightClick}>Right</button>
        </div>
      </div>
    </div>
  );
}

export default App;
