"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('youtube')) {
        return;
    }

    var $ = Breinify.UTL._jquery();
    var overload = Breinify.plugins._overload();

    var internal = {
        frequencyInMs: 1000,
        initialized: false,
        type: null,
        listenerName: 'YT_VIDEO_STARTED_BRE_LISTENER',
        videoIdToElementIdMapper: {},
        videoIdHandler: {},
        startedVideoIds: {},
        playTimelines: {},
        playObserver: {},

        init: function () {
            if (this.initialized === true) {
                return false;
            }

            // set the listener
            var _self = this;
            window[this.listenerName] = function (event) {
                _self.youTubeEventHandler(event);
            };

            this.initialized = true;
            return true;
        },

        stopTimelineRecording: function(arg) {
            var _self = this;
            var videoIds = $.isArray(arg) ? arg : [arg];

            var results = {};
            for (var i = 0; i < videoIds.length; i++) {
                var videoId = videoIds[i];

                // clear the handler
                var handler = this.playObserver[videoId];
                window.clearInterval(handler);

                // get the last result
                var recording = this.getTimelineRecording(videoId);

                // cleanup the data
                delete this.playTimelines[videoId];
                delete this.playObserver[videoId];

                // if we don't have any object we are done with this id
                if (!$.isPlainObject(recording)) {
                    continue;
                }

                results[videoId] = recording;
            }

            return results;
        },

        startTimelineRecording: function (arg) {
            var _self = this;
            var videoIds = $.isArray(arg) ? arg : [arg];

            var activatedVideoIds = [];
            for (var i = 0; i < videoIds.length; i++) {
                var videoId = videoIds[i];
                if ($.isPlainObject(this.playTimelines[videoId])) {
                    continue;
                }

                // set the default
                this.playTimelines[videoId] = {
                    timeline: []
                };

                // setup the interval checker
                this.checkVideoStatus(videoId);
                this.playObserver[videoId] = setInterval(function () {
                    _self.checkVideoStatus(videoId);
                }, this.frequencyInMs);

                // collect for return value
                activatedVideoIds.push(videoId);
            }

            return activatedVideoIds;
        },

        getTimelineRecording: function (videoId) {
            var recording = this.playTimelines[videoId];
            return $.isPlainObject(recording) ? recording : null;
        },

        checkVideoStatus: function (videoId) {
            var player = this.getPlayerByVideoId(videoId);

            // if we have an invalid player, wait until it gets valid
            if (!$.isFunction(player.getPlayerState)) {
                return;
            }

            // make sure the video is actually started
            var state = player.getPlayerState();
            if (state === YT.PlayerState.UNSTARTED) {
                return;
            }

            var now = new Date().getTime();
            var last = this.playTimelines[videoId].video;
            last = $.isPlainObject(last) ? last : {
                start: now,
                currentState: YT.PlayerState.UNSTARTED
            };

            // if the video was already ended we do not have to record anything further
            if (state === YT.PlayerState.ENDED && last.currentState === YT.PlayerState.ENDED) {
                return;
            }

            // get some player and playtime specific information
            var currentDuration = player.getCurrentTime();
            var totalDuration = player.getDuration();

            totalDuration = typeof totalDuration === 'number' ? totalDuration.toFixed(2) : 0;
            currentDuration = typeof currentDuration === 'number' ? currentDuration.toFixed(2) : 0;

            this.playTimelines[videoId].timeline.push(totalDuration === 0 ? 0 : Math.min(1.0, (currentDuration / totalDuration).toFixed(4)));
            this.playTimelines[videoId].video = {
                start: last.start,
                currentState: state,
                videoId: videoId,
                lastUpdate: now,
                totalDuration: totalDuration,
                frequencyInMs: this.frequencyInMs
            };
        },

        youTubeEventHandler: function (event) {

            var videoId = this.getVideoId(event.target);
            if (videoId === null) {
                return;
            }

            var $el = this.getElementByVideoId(videoId);
            if ($el === null) {
                return;
            }

            var handlers = this.videoIdHandler[videoId];
            if (!$.isArray(handlers)) {
                return;
            }

            // let's detect some helpful information from the event
            var firstStart = this.startedVideoIds[videoId];
            if (typeof firstStart === 'boolean') {
                // we know the result nothing to do
            } else if (event.data === YT.PlayerState.PLAYING) {
                this.startedVideoIds[videoId] = true;
                firstStart = true;
            } else {
                firstStart = false;
            }

            // trigger each handler
            for (var i = 0; i < handlers.length; i++) {
                handlers[i](videoId, $el, event, {
                    firstStart: firstStart
                });
            }
        },

        bindYouTubeObserver: function ($el, handler) {
            if (!$.isFunction(handler)) {
                return null;
            }

            var id = $el.attr('id');
            if (typeof id !== 'string' && id === '') {
                return null;
            }

            var player = YT.get(id);
            var videoId = this.getVideoId(player);

            // if there is no videoId available, we do not have a valid element
            if (videoId === null) {
                return null;
            }
            // check if already bound
            else if (typeof this.videoIdToElementIdMapper[videoId] === 'string') {
                this.videoIdHandler[videoId].push(handler);
                return videoId;
            }
            // if not bound, bind it now
            else {
                this.videoIdHandler[videoId] = [handler];
                this.videoIdToElementIdMapper[videoId] = id;
                player.addEventListener('onStateChange', this.listenerName);

                return videoId;
            }
        },

        getElementByVideoId: function (videoId) {
            if (typeof videoId !== 'string') {
                return null;
            }

            var elementId = this.videoIdToElementIdMapper[videoId];
            var $el = $('#' + elementId);

            return $el.length === 1 ? $el : null;
        },

        getPlayerByVideoId: function (videoId) {
            var $el = this.getElementByVideoId(videoId);

            var id = $el.attr('id');
            if (typeof id !== 'string' && id === '') {
                return null;
            }

            var player = YT.get(id);
            if (typeof player === 'object') {
                return player;
            } else {
                return null;
            }
        },

        getVideoId: function (player) {
            if (typeof player !== 'object' || !$.isFunction(player.getVideoData)) {
                return null;
            }

            var videoData = player.getVideoData();

            var videoId = $.isPlainObject(videoData) ? videoData.video_id : null;
            if (typeof videoId === 'string') {
                return videoId;
            } else {
                return null;
            }
        }
    };

    var YouTube = {

        init: function () {
            internal.init();
        },

        isInitialized: function () {
            return internal.initialized;
        },

        startTimelineRecording: function (videoId) {
            return internal.startTimelineRecording(videoId);
        },

        stopTimelineRecording: function (videoId) {
            return internal.stopTimelineRecording(videoId);
        },

        getTimelineRecording: function (videoId) {
            return internal.getTimelineRecording(videoId);
        },

        observeElements: function ($iFrames, handler) {

            // make sure we are initialized
            this.init();

            var videoIds = [];
            $iFrames.each(function (idx) {
                var videoId = internal.bindYouTubeObserver($(this), handler);
                if (videoId !== null) {
                    videoIds.push(videoId);
                }
            });

            return videoIds;
        }
    };

    // bind the module
    Breinify.plugins._add('youtube', YouTube);
})();