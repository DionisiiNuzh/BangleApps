(() => {
  function setupHRMAndLocationServices() {
    // Setup BLE advertisement for heart rate and location services
    NRF.setAdvertising({
      0x180d: undefined, // Heart rate service
      0x1819: undefined  // Location and navigation service
    }, {
      connectable: true,
      discoverable: true,
      scannable: true,
      whenConnected: true,
    });

    NRF.setServices({
      0x180D: { // Heart rate service
        0x2A37: { // Heart rate measurement characteristic
          notify: true,
          value: [0x06, 0],
        },
        0x2A38: { // Body sensor location characteristic
          value: 0x02, // Wrist
        }
      },
      0x1819: { // Location and navigation service
        0x2A67: { // Location and speed characteristic
          notify: true,
          value: new Uint8Array(14), // Initial value, all fields zeroed
        }
      }
    });
  }

  function updateBLEHeartRateAndLocation(hrm, lat, lon) {
    if (hrm === undefined || hrm.confidence < 50) return;
    try {
      // Update heart rate
      NRF.updateServices({
        0x180D: {
          0x2A37: {
            value: [0x06, hrm.bpm],
            notify: true
          }
        }
      });

      // Update location if available
      if (lat !== undefined && lon !== undefined) {
        let flags = 0x04; // 0b00000100: Position Status = Present (2 bits)
        let latitude = Math.round(lat * 1e7);
        let longitude = Math.round(lon * 1e7);

        // Prepare data buffer (14 bytes: 2 flags + 4 latitude + 4 longitude + others)
        let data = new Uint8Array(14);
        data[0] = flags; // Flags byte
        data.set(new Uint32Array([latitude]).buffer, 2); // Latitude (4 bytes)
        data.set(new Uint32Array([longitude]).buffer, 6); // Longitude (4 bytes)

        NRF.updateServices({
          0x1819: {
            0x2A67: {
              value: data,
              notify: true
            }
          }
        });
      }
    } catch (error) {
      handleBLEError(error);
    }
  }

  function handleBLEError(error) {
    console.log("[Error] BLE Update: " + error.message);
    if (error.message.includes("BLE restart") || error.message.includes("UUID")) {
      setupHRMAndLocationServices(); // Attempt to re-setup services
    }
  }

  setupHRMAndLocationServices();

  // Turn on GPS and listen for location updates
  Bangle.setGPSPower(1);
  Bangle.on('GPS', function (gps) {
    if (gps.fix) {
      Bangle.on("HRM", function(hrm) {
        updateBLEHeartRateAndLocation(hrm, gps.lat, gps.lon);
      });
    }
  });
})();