// Global variables and init

var full_attribution_list = [];
var soundscape_compleixty = 40;
var soundscape_complexity_interval = 3000;
var query_page_size = 15;
var play_timers = [];
var am = undefined; // Audio manager
var currentlyPlayedSounds = [];
var incomingSounds = [];
var incomingSoundsCopy = [];
var evolutionTimer = undefined;
var evolutionCurrentStep = 0;
var evolutionResolution = 100; // Number of steps per month
var evolutionTimeInterval = (90 * 1000) / evolutionResolution; // How long it takes for a full month to evolve to the next
var ratings_mode_label = 'rt';
var downloads_mode_label = 'dl';

var currentWindowWidth;
var currentWindowHeight;
var resizeTimer;


window.onload = function () {
    freesound.setToken("d31c795be3f70f7f04b21aeca4c5b48a599db6e9");
    document.getElementById('complexity').value = soundscape_compleixty;

    // Chose random month/year
    var currentYear = (new Date()).getFullYear();
    var oldestYear = 2005;
    var randomYear = oldestYear + parseInt(Math.random() * ((currentYear + 1) - oldestYear), 10)
    var randomMonth = parseInt(Math.random() * 12, 10) + 1;
    if (randomYear === oldestYear) {
        if (randomMonth < 3) {
            randomMonth = 3;
        }
    } else if (randomYear === currentYear) {
        if (randomMonth >= (new Date()).getMonth() + 1) {
            randomMonth = (new Date()).getMonth() + 1;
        }
    }
    document.getElementById('year').value = randomYear;
    document.getElementById('month').value = randomMonth;

    document.getElementById('volume').value = 0.75;
    document.getElementById('alternate_label').innerHTML = ratings_mode_label; // set by default

    parseHashAndSetParams();
    setButtonFlashEvents();

    const urlParams = new URLSearchParams(window.location.search);
    const recordParameter = urlParams.get('record');
    if (recordParameter !== null){
        showRecordButton(); // Enable redcording mode
    }

    // Configure bg moving. Only start animation if using safari (others seem slow...)
    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    var bg1isStatic = true;
    var bg2isStatic = true;
    if (isSafari){
        bg1isStatic = false;
    }

    currentWindowWidth = window.innerWidth;
    currentWindowHeight = window.innerHeight;

    // Adjust background size for first time
    configureBackground("movingbg", bg1isStatic);
    if (!isSafari){
        configureBackground("movingbg2", bg2isStatic);
    }
    

    // Trigger events for re-adjusting window size when needed
    window.addEventListener('resize', function (event) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if ((window.innerWidth !== currentWindowWidth)){
                configureBackground("movingbg", bg1isStatic);
                if (!isSafari) {
                    configureBackground("movingbg2", bg2isStatic);
                }
                currentWindowWidth = window.innerWidth;
                currentWindowHeight = window.innerHeight;
            }
        }, 250);
    });
};

function configureBackground(bgElementId, isStatic){
    var ww = window.innerWidth;
    var wh = window.innerHeight;
    var extraScaleFactor = Math.random() * 1 + 2; // Add some randomeness in bg
    var width = ww * extraScaleFactor;
    var height = wh * extraScaleFactor;
    if (width > height) {
        height = width;
    } else {
        width = height;
    }
    var top = (wh/2) - height/2;
    var left = (ww/2) - width/2;
    var time = 60;
    var animationDelay = - (Math.random() * time).toFixed(0);

    var element = document.getElementById(bgElementId);
    element.style.top = top.toString() + 'px';
    element.style.left = left.toString() + 'px';
    element.style.width = width.toString() + 'px';
    element.style.height = height.toString() + 'px';
    element.style.background = 'url("background2.png")';
    element.style.backgroundSize = width.toString() + 'px ' + height.toString() + 'px';
    element.style.animation = 'bg-slide';
    element.style.animationDuration = time.toString() + 's';
    element.style.animationTimingFunction = 'linear';
    element.style.animationIterationCount = 'infinite';
    element.style.animationDirection = (Math.random() > 0.5) ? 'normal' : 'reverse';
    element.style.animationDelay = animationDelay.toString() + 's';
    if (isStatic === true){
        element.style.animationPlayState = 'paused';
    }
}

function setButtonFlashEvents(){
    // Need to remove flash efects class so it can be repeated

    var elems = document.getElementsByClassName('input_focus_enter');
    for (var i = 0; i < elems.length; i++) {
        elems[i].addEventListener('keyup', function (e) {
            if (e.which == 13) {
                this.blur();
                this.classList.add('flash_input');
            }
        });
        elems[i].addEventListener('animationend', function (e) {
            this.classList.remove('flash_input');
        });
    }

    document.getElementById('next_button').addEventListener('animationend', function (e) {
        this.classList.remove('flash_input');
    });

    document.getElementById('previous_button').addEventListener('animationend', function (e) {
        this.classList.remove('flash_input');
    });

    document.getElementById('play_button').addEventListener('animationend', function (e) {
        this.classList.remove('flash_input');
    });

    document.getElementById('stop_button').addEventListener('animationend', function (e) {
        this.classList.remove('flash_input');
    });

    document.getElementById('alternate_label').addEventListener('animationend', function (e) {
        this.classList.remove('flash_input');
    });

    document.getElementById('autoadvance_label').addEventListener('animationend', function (e) {
        this.classList.remove('flash_input');
    });
}

function initSoundArrays() {
    currentlyPlayedSounds = [];
    incomingSounds = [];
    incomingSoundsCopy = [];
    play_timers = [];
}

// Audio stuff

function lazyInitAudioManager() {
    // Lazily initialize audio manager
    // We only init audio manager when we really need it (when a sound is to be played)
    // In this way we expect to avoid restrictions in browsers where audio
    // is only played when users have made some interactions
    if (am === undefined) {
        am = initAudioManager();
        setVolume();
    }
}

function getPlayingIndicatorHTML() {
    return '<img class="playing-indicator-img" src="speaker.png" />';
}

function showPlayingIndicator(elementID) {
    var playing_indicator_element = document.getElementById(elementID);
    if (playing_indicator_element !== null) {
        playing_indicator_element.innerHTML = getPlayingIndicatorHTML();
    }
}

function hidePlayingIndicator(elementID) {
    var playing_indicator_element = document.getElementById(elementID);
    if (playing_indicator_element !== null) {
        playing_indicator_element.innerHTML = '';
    }
}

function playSound(name, url) {

    // Only play sound if a random number is above a specific probability, otherwise try
    // again after some time.
    if (100.0 * Math.random() >= (100.0 - soundscape_compleixty)) {
        clearPlayTimersForSound(url); // Remove existing play timer for this sound (if any)
        var element_playing_indicator_id = 'play_placeholder_' + url;
        showPlayingIndicator(element_playing_indicator_id);
        am.playSoundFromURL(url, 0, {
            panHRTF: { x: randomBetween(-1.0, 1.0), y: randomBetween(-2.0, 2.0), z: randomBetween(-2.0, 2.0) },
            onended: function (event) {
                hidePlayingIndicator(element_playing_indicator_id);
                playSound(name, url);  // On end, play again the sound
                // NOTE: we don't use Web Audio API loop prop here as it does not trigger onended event
            }
        });
    } else {
        var play_timer = setTimeout(function () {
            playSound(name, url);
        }, soundscape_complexity_interval);
        play_timers.push({ name: url, timer: play_timer });
    }
}

function playCurrentSounds() {
    // Compare currentlyPlayedSounds and the sounds that are really being played in am:

    var currentBufferNodes = am.getAllUniqueBufferNodesList();
    var nAddedToPlay = 0;
    var nRemovedFromPlay = 0;

    // 1) add sounds to am which are not really being played but are in currentlyPlayedSounds
    for (i in play_timers) {
        currentBufferNodes.push(play_timers[i].name);  // Expand with sound URLs which are waiting to be played in timer
    }
    for (i in currentlyPlayedSounds) {
        var snd = currentlyPlayedSounds[i];
        var url = snd.previews['preview-hq-mp3']; // ogg seems to fail on safari...
        if (currentBufferNodes.indexOf(url) === -1) {
            // If sound not present in buffer, start to play it
            var label = snd.name + ' by ' + snd.username;
            playSound(label, url);
            //console.log('Adding sound to play ', url);
            nAddedToPlay += 1;
        }
    }

    // 2) remove sounds from am which are not in currentlyPlayedSounds
    var currentlyPlayedSoundsURLs = currentlyPlayedSounds.map(x => x.previews['preview-hq-mp3']);  // Get currently played sound URLs (useful later)

    for (i in currentBufferNodes) {
        var name = currentBufferNodes[i];
        if (currentlyPlayedSoundsURLs.indexOf(name) === -1) {
            // If buffer not present in sounds, remove it
            am.stopBufferNodesForSound(name, disableOnEnded = true, hardStop = true, removeBuffer = true); // TODO: try to set hard stop to false and see if it makes difference
            //console.log('Removing sound from play ', name);
            nRemovedFromPlay += 1;
        }
    }

    if ((nAddedToPlay > 0) || (nRemovedFromPlay > 0)) {
        console.log(nAddedToPlay + ' sound added to play, ' + nRemovedFromPlay + ' removed');
    }

    // 3) Update attribution list accordingly
    var currentAttributionListElement = document.getElementById('attributionList');
    var newAttributionListInnerHTML = '';
    for (i in currentlyPlayedSounds) {
        var snd = currentlyPlayedSounds[i];
        var sound_div_id = "sound_" + snd.id;
        var play_placeholder_id = 'play_placeholder_' + snd.previews['preview-hq-mp3'];
        var soundPlayingIndicatorIsOn = (document.getElementById(play_placeholder_id) !== null) && (document.getElementById(play_placeholder_id).innerHTML !== '');
        play_placeholder_content = '';
        if (soundPlayingIndicatorIsOn) {
            play_placeholder_content = getPlayingIndicatorHTML();
        }
        var label = '<div id="' + sound_div_id + '"><a href="' + snd.url + '" target="_blank" class="soundname">' + snd.name + '</a> by <span class="username">' + snd.username + '</span><span class="play_placeholder" id="' + play_placeholder_id + '">' + play_placeholder_content + '</span></div>';
        newAttributionListInnerHTML += label;
        
        if (full_attribution_list.indexOf(label) === -1) {
            full_attribution_list.push(label)
        }
    }
    document.getElementById('attributionList').innerHTML = newAttributionListInnerHTML;
}

function clearPlayTimersForSound(url) {
    var new_play_timers = [];
    for (var i = 0; i < play_timers.length; i++) {
        if (play_timers[i].name === url) {
            var timer = play_timers[i].timer;
            clearTimeout(timer);
        } else {
            new_play_timers.push(play_timers[i]);
        }
    }
    play_timers = new_play_timers;
}

function stopAllSounds() {

    // Stop all playing audio buffers (if am was ever initialized only)
    am.stopAllBufferNodes(disableOnEnded = true, hardStop = true, removeBuffers = true);

    // Clear all existing timeouts
    for (var i = 0; i < play_timers.length; i++) {
        var timer = play_timers[i].timer;
        clearTimeout(timer);
    }
    play_timers = [];

    // Update UI
    document.getElementById("stop_button").style.display = 'none';
    document.getElementById("play_button").style.display = 'inline-block';
    
    var elems = document.getElementsByClassName("play_placeholder");
    for (var i = 0; i < elems.length; i++) {
        elems[i].innerHTML = "";
    }
    //document.getElementById("respSearch").innerHTML = "";
}

function softStopAllSounds() {
    // Stop all playing audio buffers (if am was ever initialized only)
    am.stopAllBufferNodes(disableOnEnded = true, hardStop = false, removeBuffers = true);

    // Clear all existing timeouts
    for (var i = 0; i < play_timers.length; i++) {
        var timer = play_timers[i].timer;
        clearTimeout(timer);
    }
    play_timers = [];

}


// Util functions

function randomBetween(min, max) {
    // from https://stackoverflow.com/questions/4959975/generate-random-number-between-two-numbers-in-javascript
    if (min < 0) {
        return min + Math.random() * (Math.abs(min) + max);
    } else {
        return min + Math.random() * max;
    }
}

function shuffleArray(array) {
    // from https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function parseHashAndSetParams() {
    // Set month, year and popularity measure from hash (if present)
    var hash = window.location.hash;
    hash = hash.slice(1, hash.length).split(',');

    var month = hash[0];
    var year = hash[1];
    var alternative = hash[2];
    var complexity = hash[3];
    var auto_advance = hash[4];
    var evolution_percentage = hash[5];

    if ((month !== undefined) && (year !== undefined)) {
        document.getElementById('month').value = month;
        document.getElementById('year').value = year;
    }
    if (alternative == 'true') {
        document.getElementById("alternative").checked = true;
        document.getElementById('alternate_label').innerHTML = downloads_mode_label;
    } else if (alternative == 'false') {
        document.getElementById("alternative").checked = false;
        document.getElementById('alternate_label').innerHTML = ratings_mode_label;
    }
    if (complexity) {
        soundscape_compleixty = complexity;
        document.getElementById("complexity").value = soundscape_compleixty;
    }
    if (evolution_percentage) {
        var newEvolutionCurrentStep = parseInt(evolution_percentage / 100 * evolutionResolution, 10);
        if ((newEvolutionCurrentStep > evolutionResolution) || (newEvolutionCurrentStep < 0)) {
            newEvolutionCurrentStep = 0;
        }
        evolutionCurrentStep = newEvolutionCurrentStep;  // Set current evolution step
    }

    displayEvolutionProgress();
    if (auto_advance == 'true') {
        document.getElementById("auto_advance").checked = true;
        document.getElementById('autoadvance_label').innerHTML = 'on';
    } else if (auto_advance == 'false') {
        hideEvolutionProgress();
        document.getElementById("auto_advance").checked = false;
        document.getElementById('autoadvance_label').innerHTML = 'off';
    }
}

function yearChange(){
    var element = document.getElementById('year');
    setHash();
    play();  // Sync to current date
}

function monthChange(){
    var element = document.getElementById('month');
    if (element.value < 1){
        element.value = 1;
    }
    if (element.value > 12) {
        element.value = 12;
    }
    setHash();
    play();  // Sync to current date
}

function setHash() {
    var hash = document.getElementById('month').value + ',' +
        document.getElementById('year').value + ',' +
        document.getElementById('alternative').checked + ',' +
        document.getElementById('complexity').value + ',' +
        document.getElementById('auto_advance').checked + ',' +
        getCurrentEvolutionPercentage();
    ;
    parent.location.hash = hash;
}

function getLicenseName(license_url) {
    return {
        'http://creativecommons.org/licenses/by/3.0/': 'CC-BY',
        'http://creativecommons.org/publicdomain/zero/1.0/': 'CC0',
        'http://creativecommons.org/licenses/by-nc/3.0/': 'CC-BY-NC',
        'http://creativecommons.org/licenses/sampling+/1.0/': 'CC-S+',
    }[license_url]

}

function getNextMonth(month) {
    if (parseInt(month, 10) >= 12) {
        return "1"
    } else {
        return (parseInt(month, 10) + 1).toString()
    }
}

function getNextYear(year, month) {
    if (parseInt(month, 10) >= 12) {
        return (parseInt(year, 10) + 1).toString()
    } else {
        return year
    }
}

function getPreviousMonth(month) {
    if (parseInt(month, 10) <= 1) {
        return "12"
    } else {
        return (parseInt(month, 10) - 1).toString()
    }
}

function getPreviousYear(year, month) {
    if (parseInt(month, 10) <= 1) {
        return (parseInt(year, 10) - 1).toString()
    } else {
        return year
    }
}

function getCurrentEvolutionPercentage() {
    return Math.ceil(100 * (evolutionCurrentStep) / evolutionResolution);
}

function displayEvolutionProgress() {
    var percentage = getCurrentEvolutionPercentage();
    // If evolution is active
    document.getElementById('evolution_percentage_indicator').style.display = 'inline-block';
    document.getElementById('evolution_percentage_indicator_loader').style.width = parseInt(percentage, 10) + '%';
}

function hideEvolutionProgress() {
    //document.getElementById('evolution_percentage_indicator').style.display = 'none';
}

function displayFlashNextMonth() {
    document.getElementById('month').classList.add('flash_input');
    document.getElementById('year').classList.add('flash_input');
}


// Button interactions

function play_button(){
    document.getElementById('play_button').classList.add('flash_input'); // Add flash effect on press
    play();
}

function play() {

    //document.getElementById('attributionList').innerHTML = '';
    lazyInitAudioManager(); // Init audio context here in response to user action
    stopAllSounds();
    initSoundArrays();
    setHash();
    
    // Get sounds for current month
    var month = document.getElementById('month').value;
    var year = document.getElementById('year').value;
    search(month, year, function (data) {
        sounds = data.results;
        if (data.results.length === 0) {
            document.getElementById("attributionList").innerHTML = "No results...";
        } else {
            document.getElementById("play_button").style.display = 'none';
            document.getElementById("stop_button").style.display = 'inline-block';

            document.getElementById("attributionList").innerHTML = "Loading sounds... will begin playing at any moment...";
            shuffleArray(sounds);
            currentlyPlayedSounds = sounds;
            playCurrentSounds();
            if (document.getElementById('auto_advance').checked) {
                startEvolution(); // Start when we receive first sounds	
            }
        }
    });

    // Get sounds for next month
    var next_month = getNextMonth(month);
    var next_year = getNextYear(year, month);
    search(next_month, next_year, function (data) {
        if (data.results.length === 0) {
            document.getElementById("attributionList").innerHTML = "No results...";
        } else {
            sounds = data.results;
            shuffleArray(sounds);
            incomingSounds = sounds;
            incomingSoundsCopy = incomingSounds; // Store a copy of all original incoming sounds for later use	                
        }
    });
}

function next_button(){
    document.getElementById('next_button').classList.add('flash_input'); // Add flash effect on press
    next();
}

function next() {
    var month = document.getElementById('month').value;
    var year = document.getElementById('year').value;
    document.getElementById('month').value = getNextMonth(month);
    document.getElementById('year').value = getNextYear(year, month);
    displayFlashNextMonth();
    setHash();
    if (evolutionTimer !== undefined) {
        // If evolution is running stop it and set step to 0
        stopEvolution();
        hideEvolutionProgress();
    }
    evolutionCurrentStep = 0;
    play();
}

function previous_button(){
    document.getElementById('previous_button').classList.add('flash_input'); // Add flash effect on press
    previous();
}

function previous() {
    var month = document.getElementById('month').value;
    var year = document.getElementById('year').value;
    document.getElementById('month').value = getPreviousMonth(month);
    document.getElementById('year').value = getPreviousYear(year, month);
    displayFlashNextMonth();
    setHash();
    if (evolutionTimer !== undefined) {
        // If evolution is running stop it and set step to 0
        stopEvolution();
        hideEvolutionProgress();
    }
    evolutionCurrentStep = 0;
    play();
}

function setComplexity() {
    var element = document.getElementById('complexity');
    if (element.value < 5){
        element.value = 5;
    }
    if (element.value > 100) {
        element.value = 100;
    }
    soundscape_compleixty = element.value;
    setHash();
}

function setVolume() {
    value = document.getElementById('volume').value;
    am.setMainVolume(value);
}

function setAutoAdvance() {
    var autoAdvance = document.getElementById('auto_advance').checked;
    var isRunning = evolutionTimer !== undefined;
    if (!autoAdvance) {
        if (isRunning) {
            stopEvolution();
        }
        hideEvolutionProgress();
    } else {
        if (currentlyPlayedSounds.length > 0) {
            // If sounds are being played, start evolution now
            startEvolution();
        }
        displayEvolutionProgress();
    }
    setHash();
}

function setPopularityMeasure() {
    // The popularity measure is used when new sounds are searched in Freesound.
    // However, if we are in "auto advance" mode and there are incoming sounds, we can
    // do a search and replace the sounds in incoming with new sounds retrieved with the
    // the newly set popularity measure

    if (incomingSounds.length > 0) {
        var month = document.getElementById('month').value;
        var year = document.getElementById('year').value;
        var next_month = getNextMonth(month);
        var next_year = getNextYear(year, month);
        search(next_month, next_year, function (data) {
            if (data.results.length === 0) {
                document.getElementById("attributionList").innerHTML = "No results...";
            } else {
                // Chose new sounds to replace incoming sounds
                sounds = data.results;
                shuffleArray(sounds);
                var newlyChosenSounds = sounds.slice(0, incomingSounds.length);

                // Update incomingSoundsCopy with the new sounds
                // Iterate over existing incomingSoundsCopy and remove those that have not yet been added to currentlyPlayedSounds
                var newIncomingSoundsCopy = [];
                var currentlyPlayedSoundsURLs = currentlyPlayedSounds.map(x => x.url);
                for (i in incomingSoundsCopy) {
                    var incomingSound = incomingSoundsCopy[i];
                    if (currentlyPlayedSoundsURLs.indexOf(incomingSound.url) > -1) {
                        newIncomingSoundsCopy.push(incomingSound);
                    }
                }
                // Now add the newly retrieved sounds
                newIncomingSoundsCopy = newIncomingSoundsCopy.concat(newlyChosenSounds);
                incomingSoundsCopy = newIncomingSoundsCopy;

                // Update incoming sounds
                incomingSounds = newlyChosenSounds;
            }
        });
    }

    setHash();  // Update hash
}

function panic_button(){
    document.getElementById('stop_button').classList.add('flash_input'); // Add flash effect on press
    panic();
}

function panic() {
    if (evolutionTimer !== undefined) {
        stopEvolution();
    }
    stopAllSounds();
    initSoundArrays();
}

// Search and interaction with Freesound

function search(month, year, onSuccess, onFailure) {

    var q = "";
    var p = 1;
    var fields = "id,name,previews,username,license,url"
    var s = "rating_desc"; // Default is by ratings
    if (document.getElementById('alternative').checked) { s = "downloads_desc"; }

    var next_month = getNextMonth(month);
    var next_year = getNextYear(year, month);
    var f = "created:[" + year + "-" + month + "-1T00:00:00Z TO " + next_year + "-" + next_month + "-01T00:00:00Z] duration:[0.0 TO 60]";

    freesound.textSearch(q, { page: p, filter: f, sort: s, fields: fields, page_size: query_page_size },
        function (data) {
            // Process successful response
            onSuccess(data);
        }, function () {
            // Process error response
            document.getElementById("attributionList").innerHTML = "Error while searching...";
            if (onFailure !== undefined) {
                onFailure();
            }
        }
    );

    if (document.getElementById("attributionList").innerHTML.indexOf('use headphones') > -1){
        // Show waiting for resutls only the first time
        document.getElementById("attributionList").innerHTML = "Waiting for results...";
    }
}

// Evolution

function step() {

    var month = document.getElementById('month').value;
    var year = document.getElementById('year').value;
    var monthProgress = 100 * (evolutionCurrentStep + 1) / evolutionResolution;

    // Update currentlyPlayedSounds by adding some from incomingSounds
    var madeAnyChanges = false;
    if (evolutionCurrentStep > 0) {
        if ((currentlyPlayedSounds.length > 0) && (incomingSounds.length > 0)) { // If there are still sounds to be added

            var soundsShouldHaveBeenAdded = Math.floor(monthProgress / 100 * incomingSoundsCopy.length);
            var soundsHaveBeenAdded = incomingSoundsCopy.length - incomingSounds.length;
            var nSoundsToAdd = soundsShouldHaveBeenAdded - soundsHaveBeenAdded

            for (var i = 0; i < nSoundsToAdd; i++) {
                // Remove one sound from the top of currentlyPlayedSounds, add one sound from incoming at the end
                currentlyPlayedSounds = currentlyPlayedSounds.slice(1, currentlyPlayedSounds.length);
                currentlyPlayedSounds.push(incomingSounds[0]);
                incomingSounds = incomingSounds.slice(1, incomingSounds.length);
            }

            if (nSoundsToAdd > 0) {
                console.log('Moved ' + nSoundsToAdd + ' sounds from incoming to current');
                madeAnyChanges = true;
            }
        }
    }

    // Update audio players, etc.
    if (madeAnyChanges) {
        playCurrentSounds();
    }

    if (evolutionCurrentStep >= (evolutionResolution - 1)) {  // Last step
        // Advance 1 month
        var next_month = getNextMonth(month);
        var next_year = getNextYear(year, month);
        document.getElementById('month').value = next_month;
        document.getElementById('year').value = next_year;
        displayFlashNextMonth();

        // Check if we are in the future and should stop
        var currentRealYear = (new Date()).getFullYear();
        if (next_year >= currentRealYear) {
            if (next_year > currentRealYear) {
                stopEvolution();
                displayEvolutionProgress();
                softStopAllSounds();
                document.getElementById("attributionList").innerHTML = "No sounds for the future (yet)...";
                setHash(); // Update hash in URL
                return 0;
            } else {
                // next_year === currentRealYear
                var currentRealMonth = (new Date()).getMonth();
                if (next_month > currentRealMonth) {
                    stopEvolution();
                    displayEvolutionProgress();
                    softStopAllSounds();
                    document.getElementById("attributionList").innerHTML = "No sounds for the future (yet)...";
                    return 0;
                }
            }
        }

        // Set currentlyPlayedSounds to incomingSoundsCopy (just in case it had not been fully updated after all the steps)
        currentlyPlayedSounds = incomingSoundsCopy;
        incomingSounds = [];
        incomingSoundsCopy = [];

        // Search new sounds and store in incoming
        var month = document.getElementById('month').value;
        var year = document.getElementById('year').value;
        var next_month = getNextMonth(month);
        var next_year = getNextYear(year, month);
        search(next_month, next_year, function (data) {
            sounds = data.results;
            shuffleArray(sounds);
            incomingSounds = sounds;
            incomingSoundsCopy = incomingSounds; // Store a copy of all original incoming sounds for later use
        });
        evolutionCurrentStep = 0; // Restart step counter
    } else {
        evolutionCurrentStep += 1; // Advance step
    }

    displayEvolutionProgress();
    setHash(); // Update hash in URL

    // Schedule next step
    evolutionTimer = setTimeout(function () {
        step();
    }, evolutionTimeInterval);
}

function startEvolution() {
    displayEvolutionProgress();
    evolutionTimer = setTimeout(function () {
        step();
    }, evolutionTimeInterval);
}

function stopEvolution() {
    clearTimeout(evolutionTimer);
    evolutionTimer = undefined;
}

function toggleAlternativeCheckbox() {
    // OFF = ratings, ON = downloads
    var checkbox = document.getElementById('alternative');
    var label = document.getElementById('alternate_label');
    label.classList.add('flash_input');
    if (checkbox.checked == true){
        label.innerHTML = ratings_mode_label;
        checkbox.checked = false;
    } else {
        label.innerHTML = downloads_mode_label;
        checkbox.checked = true;
    }
    setPopularityMeasure();
}

function toggleAutoAdvanceCheckbox() {
    var checkbox = document.getElementById('auto_advance');
    var label = document.getElementById('autoadvance_label');
    label.classList.add('flash_input');
    if (checkbox.checked == true) {
        label.innerHTML = 'off';
        checkbox.checked = false;
    } else {
        label.innerHTML = 'on';
        checkbox.checked = true;
    }
    setAutoAdvance();
}

function share(){
    var urlToCopy = location.href;
    var textElement = document.getElementById('clipboardURL');
    textElement.value = urlToCopy;    
    textElement.select();
    document.execCommand("copy");
    alert('Share link coppied to clipboard:\n' + urlToCopy);
}

var isRecording = false;

function start_recording(){
    lazyInitAudioManager();
    isRecording = true;
    am.startRecording();
}

function stop_recording() {
    isRecording = false;
    var filename = 'freesound_timeline_export-';
    var hash = location.hash;
    hash = hash.replace(new RegExp(',', 'g'), '-');
    hash = hash.replace(new RegExp('#', 'g'), '');
    filename += hash;
    am.stopRecording(filename);
}

function record_button() {
    var buttonElement = document.getElementById("record_button");
    if (isRecording){
        stop_recording();
        buttonElement.classList.remove('flash_input_infinite');
    } else {
        start_recording();
        buttonElement.classList.add('flash_input_infinite');
    }
}

function showRecordButton() {
    var buttonElement = document.getElementById("record_button");
    buttonElement.style.display = 'inline-block';
    var buttonsLeftEelement = document.getElementById("buttonsLeft");
    buttonsLeftEelement.style.width = '150px';
}