"use strict";
var express = require("express");
var path = require("path");
var fs = require('fs');
var app = express();
app.use(express.static('public'));
var arDrone = require('ar-drone');
var client = arDrone.createClient({
    ip: '192.168.1.25'
});
var arDrone = require('ar-drone');
var fs = require('fs');
var gm = require('gm');
var oxford = require('project-oxford');
var apikey = "99f45303a51d4eeea6366ba8dfea494a";
var Oxclient = new oxford.Client(apikey);
var idMap = [];
var people = [];
var myGroup = "drone_demo_group";
var found = false;
var nameToFind = "";
var device = require('azure-iot-device');
var clientFromConnectionString = require('azure-iot-device-http').clientFromConnectionString;
var location = process.env.DEVICE_LOCATION || 'Drone at Home';
var connectionString = process.env.IOTHUB_CONN || 'HostName=joedronedemo.azure-devices.net;DeviceId=parrotdrone;SharedAccessKey=4C3tHFsBqzpCH888sqw5bkUVatvaRI5xaPzaxYqshCA=';
// Create droneclient that will manage the connection to your IoT Hub
// Created in the context of an Azure IoT device, which is why
// you use a device-specific connection string.
var droneclient = clientFromConnectionString(connectionString);
var deviceId = device.ConnectionString.parse(connectionString).DeviceId;
app.get('/audio', function (req, res) {
    var tts = require('./TextToSpeechService.js');
    tts.Synthesize('Command Received Mattigan, intializing ,3 , 2, 1!');
    console.log(req.query.inputspeech);
    nameToFind = req.query.inputspeech;
    console.log("Drone Taking Off");
    client.takeoff();
    console.log("Drone Taking Pictures");
    var pngStream = client.getPngStream();
    var period = 5000; // Save a frame every 5000 ms.
    var lastFrameTime = 0;
    pngStream
        .on('error', console.log)
        .on('data', function (pngBuffer) {
        var now = (new Date()).getTime();
        if (now - lastFrameTime > period && found == false) {
            lastFrameTime = now;
            fs.writeFile(__dirname + '/Public/DroneImage.png', pngBuffer, function (err) {
                if (err) {
                    console.log("Error saving PNG: " + err);
                }
                else {
                    console.log("Saved Frame");
                    mapPersonList(myGroup);
                    identifyPATH(__dirname + '/Public/DroneImage.png', myGroup);
                }
            });
        }
    });
});
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});
// This router is sending a command to the drone 
// to take off
app.get('/takeoff', function (req, res) {
    client.takeoff();
    console.log("Drone Taking Off");
});
// This router is sending a command to the drone
// to land
app.get('/land', function (req, res) {
    client.stop(0);
    client.land();
    console.log("Drone Landing");
});
// This router is sending a command to the drone
// to calibrate. Causes the drone to fully
// rotate and balance
app.get('/calibrate', function (req, res) {
    client.calibrate(0);
    console.log("Drone Calibrating");
});
// This router is sending a command to the drone 
// to cancel all existing commands. Important if
// turning clockwise and you want to stop for
// example
app.get('/hover', function (req, res) {
    client.stop(0);
    console.log("Hover");
    client.on('navdata', function (sensordata) {
        var payload = JSON.stringify({
            deviceId: deviceId,
            location: location,
            altitude: sensordata.demo.altitude,
            batterypercentage: sensordata.demo.batteryPercentage
        });
        // Create the message based on the payload JSON
        var message = new device.Message(payload);
        // For debugging purposes, write out the message payload to the 
        console.log("Sending message: " + message.getData());
        // Send the message to Azure IoT Hub
        droneclient.sendEvent(message, printResultFor('send'));
    });
    // Helper function to print results in the console
    function printResultFor(op) {
        return function printResult(err, res) {
            if (err)
                console.log(op + ' error: ' + err.toString());
        };
    }
});
// This router is sending a command to the drone 
// to turn clockwise
app.get('/clockwise', function (req, res) {
    client.clockwise(0.5);
    console.log("Drone Turning Clockwise");
});
app.get('/photos', function (req, res) {
    console.log("Drone Taking Pictures");
    var pngStream = client.getPngStream();
    var period = 2000; // Save a frame every 2000 ms.
    var lastFrameTime = 0;
    pngStream
        .on('error', console.log)
        .on('data', function (pngBuffer) {
        var now = (new Date()).getTime();
        if (now - lastFrameTime > period && found == false) {
            lastFrameTime = now;
            fs.writeFile(__dirname + '/public/DroneImage.png', pngBuffer, function (err) {
                if (err) {
                    console.log("Error saving PNG: " + err);
                }
                else {
                    console.log("Saved Frame");
                    mapPersonList(myGroup);
                    identifyPATH(__dirname + '/public/DroneImage.png', myGroup);
                }
            });
        }
    });
});
function mapPersonList(groupId) {
    Oxclient.face.person.list(groupId)
        .catch(function (e) {
        console.log(e); // "oh, no!"
    }).then(function (response) {
        idMap = [];
        response.forEach(function (person) {
            idMap[person.personId] = person;
        });
    });
}
;
function identifyPATH(testPath, groupId) {
    Oxclient.face.detect({ path: testPath, returnFaceId: true })
        .then(function (response) {
        if (response.length == 0) {
            console.log("Response Blank");
        }
        else {
            var faceIds = [];
            var faceMap = [];
            console.log(response);
            response.forEach(function (face) {
                console.log("Counting Faces In Image");
                faceIds.push(face.faceId);
                faceMap[face.faceId] = face;
            });
            //console.log(faceMap);
            Oxclient.face.identify(faceIds, groupId)
                .then(function (response) {
                //console.log("Identifying Faces In Image");
                console.log(response);
                response.forEach(function (face) {
                    if (face.candidates && face.candidates.length > 0) {
                        var topCandidate = face.candidates[0];
                        faceMap[face.faceId]['person'] = idMap[topCandidate.personId];
                        faceMap[face.faceId]['confidence'] = topCandidate.confidence;
                    }
                });
                for (var faceId in faceMap) {
                    people.push(faceMap[faceId]);
                    var name = (faceMap[faceId].person && faceMap[faceId].person.name) || '<unknown>';
                    if (name == nameToFind) {
                        var tts = require('./TextToSpeechService.js');
                        tts.Synthesize('Found You' + nameToFind + '. I Hope You Are Having A Great Day!');
                        client.land();
                        client.stop();
                        found = true;
                    }
                    console.log(name + ' @ ' + JSON.stringify(faceMap[faceId].faceRectangle));
                    var topy = faceMap[faceId].faceRectangle.top;
                    var topx = faceMap[faceId].faceRectangle.left;
                    var bottomx = faceMap[faceId].faceRectangle.left + faceMap[faceId].faceRectangle.width;
                    var bottomy = faceMap[faceId].faceRectangle.top + faceMap[faceId].faceRectangle.height;
                    var textx = topx;
                    var texty = topy - 10;
                    var TextOut = name;
                    gm('public/DroneImage.png')
                        .fill('none')
                        .stroke("red", 4)
                        .drawRectangle(topx, topy, bottomx, bottomy)
                        .fontSize("20px")
                        .stroke("red", 2)
                        .font('/Windows/Fonts/trebuc.ttf')
                        .drawText(textx, texty, TextOut)
                        .write('public/DroneImage.png', function (err) {
                        if (err)
                            throw err;
                        console.log(response);
                    });
                }
            });
        }
    });
}
;
module.exports = app;
//# sourceMappingURL=app.js.map