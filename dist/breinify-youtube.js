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
        initialized: false,
        type: null,
        listenerName: 'YT_VIDEO_STARTED_BRE_LISTENER',
        videoIdToElementIdMapper: {},
        videoIdHandler: {},

        init: function () {

            // if we have the function attached already just ignore
            if ($.isFunction(window[this.listenerName])) {
                return false;
            }

            // set the listener
            window[this.listenerName] = function (event) {
                this.youTubeEventHandler(event);
            };

            this.initialized = true;
            return true;
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

            for (i = 0; i < handlers.length; i++) {
                handlers[i](videoId, $el, event);
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

        observeElements: function ($iFrames, handler) {

            // make sure we are initialized
            if (!this.isInitialized()) {
                this.init();
            }

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