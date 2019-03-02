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
        if (randomMonth >= (new Date()).getMonth()) {
            randomMonth = (new Date()).getMonth() - 1;
        }
    }
    if (randomMonth === 0){
        randomMonth = 1;
    }
    if (randomMonth > 12) {
        randomMonth = 12;
    }
    document.getElementById('year').value = randomYear;
    document.getElementById('month').value = randomMonth;

    parseHashAndSetParams();
    
    var elems = document.getElementsByClassName('input_focus_enter');
    for (var i = 0; i < elems.length; i++) {
        elems[i].addEventListener('keyup', function (e) {
            if (e.which == 13) this.blur();
        });
    }
    
};

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
        document.getElementById('volume').value = 0.5;
        setVolume();
    }
}

function showPlayingIndicator(elementID) {
    var playing_indicator_element = document.getElementById(elementID);
    if (playing_indicator_element !== null) {
        playing_indicator_element.innerHTML = '<img class="playing-indicator-img" src="speaker.png" />';
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
    document.getElementById('attributionList').innerHTML = '';
    for (i in currentlyPlayedSounds) {
        var snd = currentlyPlayedSounds[i];
        var label = '<a href="' + snd.url + '" target="_blank" class="soundname">' + snd.name + '</a> by <span class="username">' + snd.username + '</span><span class="play_placeholder" id="play_placeholder_' + snd.previews['preview-hq-mp3'] + '"></span>';
        document.getElementById('attributionList').innerHTML +=
            label + '<br>'// + ' | <a href="' + snd.license + '" target="_blank" class="licensename">' + getLicenseName(snd.license) + '</a><br>'

        if (full_attribution_list.indexOf(label) === -1) {
            full_attribution_list.push(label)
        }
    }

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
        document.getElementById('alternate_label').innerHTML = 'on';
    } else if (alternative == 'false') {
        document.getElementById("alternative").checked = false;
        document.getElementById('alternate_label').innerHTML = 'off';;
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
    document.getElementById('evolution_percentage_indicator').style.display = 'none';
}

function displayFlashNextMonth() {
    // Input elements need to be removed and re-added for the flash effect to work every time
    // See: https://css-tricks.com/restart-css-animation/

    var month_input = document.getElementById('month');
    var new_month_input = month_input.cloneNode(true);
    month_input.parentNode.replaceChild(new_month_input, month_input);
    document.getElementById('month').classList.add('flash_input');

    var year_input = document.getElementById('year');
    var new_year_input = year_input.cloneNode(true);
    year_input.parentNode.replaceChild(new_year_input, year_input);
    document.getElementById('year').classList.add('flash_input');
}


// Button interactions

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
    var value = document.getElementById('complexity').value;
    soundscape_compleixty = value;
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
    document.getElementById("attributionList").innerHTML = "Waiting for results...";
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
    var checkbox = document.getElementById('alternative');
    var label = document.getElementById('alternate_label');
    if (checkbox.checked == true){
        label.innerHTML = 'off';
        checkbox.checked = false;
    } else {
        label.innerHTML = 'on';
        checkbox.checked = true;
    }
    setPopularityMeasure();
}

function toggleAutoAdvanceCheckbox() {
    var checkbox = document.getElementById('auto_advance');
    var label = document.getElementById('autoadvance_label');
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
    alert('Share by copying this URL:\n' + location.href);
}