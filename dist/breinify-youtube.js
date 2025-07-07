"use strict";

(function () {
    if (typeof Breinify !== 'object') {
        return;
    }
    // make sure the plugin isn't loaded yet
    else if (Breinify.plugins._isAdded('youtube')) {
        return;
    }

    const $ = Breinify.UTL._jquery();

    const internal = {
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
                return true;
            } else if (typeof YT !== 'object' || typeof window.YT.Player !== 'function') {
                return false;
            }

            // set the listener
            const _self = this;
            window[this.listenerName] = function (event) {
                _self.youTubeEventHandler(event);
            };

            this.initialized = true;
            return true;
        },

        stopTimelineRecording: function (arg, triggerCheck) {
            const videoIds = $.isArray(arg) ? arg : [arg];

            const results = {};
            for (let i = 0; i < videoIds.length; i++) {
                const videoId = videoIds[i];

                // clear the handler
                const handler = this.playObserver[videoId];
                window.clearInterval(handler);

                // trigger check once if asked too
                if (triggerCheck === true) {
                    this.checkVideoStatus(videoId);
                }

                // get the last result
                const recording = this.getTimelineRecording(videoId);

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

        isTimelineRecorded: function (videoId) {
            return $.isPlainObject(this.playTimelines[videoId]);
        },

        startTimelineRecording: function (arg) {
            const _self = this;
            const videoIds = $.isArray(arg) ? arg : [arg];

            const activatedVideoIds = [];
            for (let i = 0; i < videoIds.length; i++) {
                const videoId = videoIds[i];
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
            const recording = this.playTimelines[videoId];
            return $.isPlainObject(recording) ? recording : null;
        },

        checkVideoStatus: function (videoId) {
            const player = this.getPlayerByVideoId(videoId);

            // if we have an invalid player, wait until it gets valid
            if (!$.isFunction(player.getPlayerState)) {
                return;
            }

            // make sure the video is actually started
            const state = player.getPlayerState();
            if (state === window.YT.PlayerState.UNSTARTED) {
                return;
            }

            const now = new Date().getTime();
            let last = this.playTimelines[videoId].video;
            last = $.isPlainObject(last) ? last : {
                start: now,
                currentState: window.YT.PlayerState.UNSTARTED
            };

            // if the video was already ended we do not have to record anything further
            if (state === window.YT.PlayerState.ENDED && last.currentState === window.YT.PlayerState.ENDED) {
                return;
            }

            // get some player and playtime specific information
            const data = this.getVideoStats(player);

            // create the instance to store
            this.playTimelines[videoId].timeline.push(data.percentage);
            this.playTimelines[videoId].video = $.extend(data, {
                start: last.start,
                lastUpdate: now
            });
        },

        getVideoStats: function (player) {
            const state = player.getPlayerState();
            let currentDuration = player.getCurrentTime();
            let totalDuration = player.getDuration();

            totalDuration = typeof totalDuration === 'number' ? totalDuration.toFixed(2) : 0;
            currentDuration = typeof currentDuration === 'number' ? currentDuration.toFixed(2) : 0;

            const percentage = totalDuration === 0 ? 0 : Math.min(1.0, (currentDuration / totalDuration).toFixed(4));

            return {
                videoId: this.getVideoIdByPlayer(player),
                currentState: state,
                currentDuration: currentDuration,
                totalDuration: totalDuration,
                frequencyInMs: this.frequencyInMs,
                percentage: percentage,
                finished: percentage === 1.0
            };
        },

        youTubeEventHandler: function (event) {

            const videoId = this.getVideoIdByPlayer(event.target);
            if (videoId === null) {
                return;
            }

            const $el = this.getElementByVideoId(videoId);
            if ($el === null) {
                return;
            }

            const handlers = this.videoIdHandler[videoId];
            if (!$.isArray(handlers)) {
                return;
            }

            // let's see if the video is started the first time
            let firstStart = this.startedVideoIds[videoId];
            if (typeof firstStart === 'boolean') {
                // we know the result nothing to do
            } else if (event.data === window.YT.PlayerState.PLAYING) {
                this.startedVideoIds[videoId] = false;
                firstStart = true;
            } else {
                firstStart = false;
            }

            // generate the data
            const data = $.extend(this.getVideoStats(event.target), {
                firstStart: firstStart
            });

            // trigger each handler
            for (let i = 0; i < handlers.length; i++) {
                handlers[i](videoId, $el, event, data);
            }
        },

        bindYouTubeObserver: function ($el, handler) {
            if (!$.isFunction(handler)) {
                return null;
            }

            const id = $el.attr('id');
            if (typeof id !== 'string' || id.trim() === '') {
                return null;
            }

            const player = window.YT.get(id);
            const videoId = this.getVideoIdByPlayer(player);

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

            const elementId = this.videoIdToElementIdMapper[videoId];
            const $el = $('#' + elementId);

            return $el.length === 1 ? $el : null;
        },

        getPlayerByVideoId: function (videoId) {
            const $el = this.getElementByVideoId(videoId);

            const id = $el.attr('id');
            if (typeof id !== 'string' || id.trim() === '') {
                return null;
            }

            const player = window.YT.get(id);
            if (typeof player === 'object') {
                return player;
            } else {
                return null;
            }
        },

        getVideoIdByElement: function ($el) {
            const id = $el.attr('id');
            if (typeof id !== 'string' || id.trim() === '') {
                return null;
            }

            const player = window.YT.get(id);
            if (typeof player === 'object') {
                return this.getVideoIdByPlayer(player);
            } else {
                return null;
            }
        },

        getVideoIdByPlayer: function (player) {
            if (typeof player !== 'object' || !$.isFunction(player.getVideoData)) {
                return null;
            }

            const videoData = player.getVideoData();
            const videoId = $.isPlainObject(videoData) ? videoData.video_id : null;
            if (typeof videoId === 'string') {
                return videoId;
            } else {
                return null;
            }
        }
    };

    const YouTube = {

        init: function () {
            return internal.init();
        },

        isTimelineRecorded: function (videoId) {
            return internal.isTimelineRecorded(videoId);
        },

        isPlaying: function (event) {
            return event.data === window.YT.PlayerState.PLAYING;
        },

        isHalted: function (event) {
            return event.data === window.YT.PlayerState.BUFFERING ||
                event.data === window.YT.PlayerState.CUED ||
                event.data === window.YT.PlayerState.PAUSED ||
                event.data === window.YT.PlayerState.UNSTARTED;
        },

        isEnded: function (event) {
            return event.data === window.YT.PlayerState.ENDED;
        },

        isInitialized: function () {
            return internal.initialized;
        },

        startTimelineRecording: function (videoId) {
            return internal.startTimelineRecording(videoId);
        },

        stopTimelineRecording: function (videoId, triggerCheck) {
            return internal.stopTimelineRecording(videoId, triggerCheck);
        },

        getTimelineRecording: function (videoId) {
            return internal.getTimelineRecording(videoId);
        },

        getVideoIdByElement: function ($el) {
            return internal.getVideoIdByElement($el);
        },

        isObservable: function($iFrames, callback) {
            const _self = this;

            $iFrames.each(function (idx) {
                const $iFrame = $(this);
                const videoId = _self.getVideoIdByElement($iFrame);
                if (videoId === null) {
                    setTimeout(function() {
                        _self.isObservable($iFrame, callback);
                    }, 50);
                } else {
                    callback($iFrame);
                }
            });
        },

        observeElements: function ($iFrames, handler) {
            const videoIds = [];

            // make sure we are initialized and activate the observation
            if (this.init()) {
                $iFrames.each(function (idx) {
                    const videoId = internal.bindYouTubeObserver($(this), handler);
                    if (videoId !== null) {
                        videoIds.push(videoId);
                    }
                });
            }

            return videoIds;
        }
    };

    // bind the module
    Breinify.plugins._add('youtube', YouTube);
})();