// audioengine.js
// Simple utility wrapper around some Web Audio API features to be able to
// quickly build applications which play sound using the Web Audio API.
// To use this functions include audioengine.js and use the AudioManager "am" 
// variable like:
//    am = initAudioManager();
//    am.playSoundFromURL("http://sound.org/example.ogg")
//    am.setMainVolume(0.5)
// If playing a sound which was already played in the future, the AudioManager
// object will keep the buffer and reuse the data.

var audioengine_verbose = false;
function log(message) {
  if (audioengine_verbose){
    console.log(message)
  }
}


// "Private" interface (don't use these methods directly outside audioengine.js)

function startAudioContext(){
    context = new (window.AudioContext || window.webkitAudioContext)();
    if (!context.createGain)
      context.createGain = context.createGainNode;
    context.gainNode = context.createGain();
    context.gainNode.connect(context.destination);
    context.listener.setOrientation(0, 0, -1, 0, 1, 0); // Set default listener orientation at the centre
}

function playBuffer(buffer, time, options) {
  const source = context.createBufferSource();
  source.buffer = buffer;

  connected = false;
  if (options !== undefined){
    if (options.loop) {
      source.loop = options.loop;
    } 
    if (options.onended) {
      source.onended = options.onended;
    }  
    if (options.panHRTF) {
      const panner = context.createPanner();
      panner.panningModel = "HRTF"
      panner.distanceModel = "inverse"
      panner.setPosition(options.panHRTF.x, options.panHRTF.y, options.panHRTF.z);
      source.connect(panner);
      panner.connect(context.gainNode);
      connected = true;
    }
  }

  if (!connected){
    // If source was not connected to master gain node because of options, connect now
    source.connect(context.gainNode);
  }
  source.start(time);
  return source;
}

function loadSounds(obj, soundMap, callback) {
  // Array-ify
  var names = [];
  var paths = [];
  for (var name in soundMap) {
    var path = soundMap[name];
    names.push(name);
    paths.push(path);
  }
  bufferLoader = new BufferLoader(context, paths, function(bufferList) {
    for (var i = 0; i < bufferList.length; i++) {
      var buffer = bufferList[i];
      var name = names[i];
      obj[name] = buffer;
    }
    if (callback) {
      callback();
    }
  });
  bufferLoader.load();
}

function BufferLoader(context, urlList, callback) {
  this.context = context;
  this.urlList = urlList;
  this.onload = callback;
  this.bufferList = new Array();
  this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function(url, index) {
  // Load buffer asynchronously
  var request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";

  var loader = this;

  request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
      request.response,
      function(buffer) {
        if (!buffer) {
          log('Error decoding file data: ' + url);
          return;
        }
        loader.bufferList[index] = buffer;
        if (++loader.loadCount == loader.urlList.length)
          loader.onload(loader.bufferList);
      },
      function(error) {
        log('DecodeAudioData error: ' + error);
      }
    );
  }

  request.onerror = function() {
    log('BufferLoader: XHR error');
  }

  request.send();
};

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i)
  this.loadBuffer(this.urlList[i], i);
};


// Public interface (AudioManager object)

var AudioManager = function() {};

AudioManager.prototype.loadSound = function(url, onLoadedCallback) {
  log('Loading: ' + url);
  var name = url;  // Use URL to identify the sound in pool
  var soundMap = {}
  soundMap[name] = url
  loadSounds(this, soundMap, function(){
    onLoadedCallback(name);
  });
}

var BUFFER_NODES = [];
AudioManager.prototype.playBufferByName = function(name, time, options) {
  log('Playing: ' + name);
  if (time === undefined){ time = 0; }
  if (name in this){
    var buffer_node = playBuffer(this[name], time, options);
    BUFFER_NODES.push(buffer_node)
  } else {
    log('Error: "' + name + '" buffer not loaded!')
  }
}

AudioManager.prototype.playSoundFromURL = function(url, time, options) {
  if (time === undefined){ time = 0; }
  if (url in this){ // If sound is already loaded, just play it
    AudioManager.prototype.playBufferByName(url, time, options);
  } else { // If sound has not been loaded, load it and play afterwards
    AudioManager.prototype.loadSound(url, function(){
      AudioManager.prototype.playBufferByName(url, time, options);
    })  
  }
}

AudioManager.prototype.setMainVolume = function(value) {
  // value should be in range [0, 1]
  if (value > 1.0){
    value = 1.0;
  } else if (value < 0){
    value = 0.0;
  }
  context.gainNode.gain.value = value;
}

AudioManager.prototype.stopAllBuffers = function(disableOnEnded) {
  for(i=0; i<BUFFER_NODES.length; i++) {
    if (disableOnEnded) {
      BUFFER_NODES[i].onended = undefined; // Set onended call to undefined just in case it is set  
    }
    BUFFER_NODES[i].stop();
  }
  BUFFER_NODES = [];
}

// Initialize things
function initAudioManager(){
  startAudioContext();
  return new AudioManager();
}
