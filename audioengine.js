// Start off by initializing a new context.
function startAudioContext(){
    context = new (window.AudioContext || window.webkitAudioContext)();
    if (!context.createGain)
      context.createGain = context.createGainNode;
    context.gainNode = context.createGain();
    context.gainNode.connect(context.destination);
}


function setVolume(value){
  context.gainNode.gain.value = value;
}


function playSound(buffer, time) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.gainNode);
  source.start(time);
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
          console.log('error decoding file data: ' + url);
          return;
        }
        loader.bufferList[index] = buffer;
        if (++loader.loadCount == loader.urlList.length)
          loader.onload(loader.bufferList);
      },
      function(error) {
        console.error('decodeAudioData error', error);
      }
    );
  }

  request.onerror = function() {
    console.log('BufferLoader: XHR error');
  }

  request.send();
};

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i)
  this.loadBuffer(this.urlList[i], i);
};

aux_player = new Audio()
function play_sound_from_url(url){
    aux_player.src = url;
    aux_player.autoplay = true;
}



var AudioManager = function() {};

AudioManager.prototype.playSoundByName = function(name, time) {
  if (time == undefined){
    time = 0;
  }
  if (name in this){
    playSound(this[name], time);
  } else {
    console.log("ERROR: " + name + " not available!")
  }
}

AudioManager.prototype.loadSound = function(name, url, callback) {
  var name = name.toString();
  var soundMap = {}
    soundMap[name] = url
    loadSounds(this, soundMap, function(){
      callback(name);
  });
}
