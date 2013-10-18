// Jquery plugin to fit text inside elements
;(function($) {
    $.fn.textfill = function(options) {
        var fontSize = options.maxFontPixels,
          center = options.center || false,
          ourText = $('p:visible:first', this),
          containerHeight = $(this).height(),
          textHeight,
          padding;

        do {
            ourText.css('font-size', fontSize);
            textHeight = ourText.height();
            fontSize = fontSize - 1;
        } while (textHeight > containerHeight && fontSize > 3);

        if (center) {
          padding = (containerHeight - textHeight) / 2.0;
          ourText.css('padding-top', padding + 'px');
        }

        return this;
    };
})(jQuery);

$(function () {
  // Quick hack for windows mobile phones because IE can't 100% bg image.
  if (navigator.userAgent.match(/Windows Phone/i)) {
    $('html').css('background', '#b2ebfb');
  }

  // 'Constants'
  var TEXTFILL_OPTIONS = {maxFontPixels: 30, center: true},
    LATEST_TWEETS_COUNT = 10,
    TWEET_CHANGE_INTERVAL = 10,
    CAMERA_INTERVAL = 300;  // 5 FPS for desktops

  if (Modernizr.mq('only screen and (max-width: 1040px)')) {
    CAMERA_INTERVAL = 1000;  // 1 FPS for mobile devices.
  }

  // Scope global
  var imageNumber = 0;

  /**
   * Returns a random integer between min and max
   * Using Math.round() will give you a non-uniform distribution!
   */
  function getRandomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function setSpeechBubbles(tweetIndex) {
    setSpeechBubble('hashtag_futulokki.json', 'hashtag-tweet', tweetIndex, true);
    setSpeechBubble('at_futulokki.json', 'channel-tweet', tweetIndex, false);

    setTimeout(function() {
      var newTweetIndex = tweetIndex + 1;
      if (newTweetIndex > LATEST_TWEETS_COUNT - 1) {
        newTweetIndex = 0;
      }
      setSpeechBubbles(newTweetIndex);
    }, 10 * 1000);
  }

  function setSpeechBubble(apiResource, elementId, tweetIndex, includeUser) {
    latestTweets(apiResource, LATEST_TWEETS_COUNT, function(data) {
      var tweets = data,
        tweet,
        text,
        signature;

      if (tweets.length === 0) {
        fadeToNewTweet(elementId, 'Empty response from Twitter');
        return;
      }

      if (tweetIndex > tweets.length - 1) {

        tweet = tweets[getRandomInt(0, tweets.length - 1)];
      } else {
        tweet = tweets[tweetIndex];
      }

      if (includeUser) {
        signature = '<br/><span class="timeago">- <a href=http://twitter.com/' +
                    tweet.user.screen_name + ">@" + tweet.user.screen_name +
                    "</a></span>";
      } else {
        signature = '';
      }

      text = linkify_entities(tweet) + signature;
      fadeToNewTweet(elementId, text);
    });
  }

  function fadeToNewTweet(elementId, text) {
    var el = $('#' + elementId);

     el.animate({opacity: 0}, function() {
      el.html(text);
      el.parent().textfill(TEXTFILL_OPTIONS);
      el.animate({opacity: 1});
    });
  }

  // Returns latest tweets from Twitter's search API. Max count is 100.
  function latestTweets(apiResource, count, callback) {
    $.ajax({
      url: "/twitterapi/" + apiResource,
      success: callback,
      error: function() {
        var error = 'Unable to fetch Tweets';
        fadeToNewTweet('hashtag-tweet', error);
        fadeToNewTweet('channel-tweet', error);
      }
    });
  }

  function nextCameraFrame() {
    var cameraImage = document.getElementById("camera-image"),
      time = new Date().getTime();

    // Avoid caching with time paremeter
    cameraImage.src = "http://lokki.futurice.com:8080/camera?_=" + time;
    imageNumber++;

    setTimeout(nextCameraFrame, CAMERA_INTERVAL);
  }

  // Make sure that custom fonts are loaded
  $(window).load(function() {
    setSpeechBubbles(0);

    if (window.PIE) {
      // Support for rounded elements in IE
      $.each(['.follow-twitter'], function(index, value) {
        $(value).each(function() {
          PIE.attach(this);
        });
      });
    }
  });

});
