Warning: This guide might contain some errors since some stuff has been censored out. Also domain names have been changed. Some parts of this project are a bit "hacky", so beware!

Web architecture
----------------

The web server is basically just a static file server. Backend consists of a cron job which fetches latest tweets from Twitter API and writes them to .json files.

Video streaming architecture
----------------------------

The streaming seems complicated but every component has a reason.

MJPG-streamer was chose instead of VLC because VLC didn't care about FPS parameter and provided full FPS video even if the FPS was set via parameters. Many others had similar problem with VLC.

SSH tunnel is set because that way, the web server does not need to know about Raspberry PI. Raspberry PI just connects to server and sets a reverse SSH tunnel.

VLC provides some extra control over the stream. It is used to scale the image and lower the video bitrate.

Paparazzo.js is used because all browsers cannot show a direct MJPEG stream. The NodeJS server is a MJPEG stream proxy. Which consumes a MJPEG stream and provides a single picture that contains always the newest fram from the stream. Browsers can then update the image with JavaScript. This method works with almost all browsers including mobile.

# Equipment

- Raspberry PI
- SD card with Raspbian installed
- HDMI cable to connect Raspberry to monitor
- Power supply, 5V and at least 700mA. This is connected to Raspberry PI's microusb port.
  For example a basic Nokia charger works.
- Internet cable or Wifi dongle(Wi-Pi is good and works out of the box)
- Raspberry compatible camera, see http://elinux.org/RPi_VerifiedPeripherals#USB_Webcams
  This is also an option: http://www.raspberrypi.org/archives/3890
  Camera should be able to output MJPEG(Motion JPEG).
  Basically a camera that is UVC compatible should work.
- You might also need USB hub with external power supply

# Setup


1. Install [Raspberry PI](#raspberry-pi)

2. Install [web server](#server-setup)

3. Happy streaming

# Raspberry PI

1. Update Raspberry PI's firmware with rpi-update. This should add uvcdriver support.

2. Install vlc. (You could also test it with lighter software than vlc)

        sudo apt-get install vlc screen

3. Test that you can get image from your camera

        vlc v4l2:///dev/video0

4. Install MJPG-streamer

        mkdir build
        cd build
        curl -L -o mjpg-streamer-latest.tar.gz "http://sourceforge.net/projects/mjpg-streamer/files/latest/download?source=dlp"
        tar xzvf mjpg-streamer-latest.tar.gz
        rm mjpg-streamer-latest.tar.gz
        cd mjpg-streamer
        make clean all
        export LD_LIBRARY_PATH=.

    Check more examples from usage: http://wolfpaulus.com/jounal/embedded/raspberrypi_webcam

5. Run MJPG-streamer

        screen -S stream
        mjpg_streamer -i "/usr/lib/input_uvc.so -d /dev/video0 -r 1920x1080 -f 6 -n" -o "/usr/lib/output_http.so -p 8080 -w build/mjpg-streamer/mjpg-streamer/www/"

    You can return to this screen with command

        screen -r stream

    Note that the -w parameter should point to the directory where MJPG streamer's demo page is located.

    The previous command will serve 6FPS 1080p video at port 8080 over HTTP. The actual stream will be served as multipart HTTP response.
    You can access the MJPEG stream from: <raspberry-ip>:8080/?action=stream
    Snapshots can be taken with: <raspberry-ip>:8080/?action=stream
    Camera controlling: <raspberry-ip>:8080/control.htm

6. Setup SSH-tunnel. Before this step, web server must have ssh installed.

    Create new file, ssh_tunnel.sh:

        #!/bin/bash
        while true; do
            /usr/bin/ssh -N -R 2222:localhost:8080 web@<public-server>
            sleep 1
        done

    Remember to replace <public-server> with your server.

    Run ssh_tunnel.sh with

        screen -S tunnel
        chmod +x ssh_tunnel.sh
        ./ssh_tunnel.sh

    You can return to this screen with command

        screen -r tunnel

    It will automatically reconnect to the host if the ssh connection breaks.
    SSH tunnel makes it possible for the server to connect to Raspberry PI
    without knowing its IP address. Connecting to server's localhost:2222
    will forward over SSH tunnel to RaspberryPI:8080.


# Server setup

1. Install web server lighttpd

        sudo apt-get install lighttpd

2. Configure lighttpd. Edit /etc/lighttpd/lighttpd.conf to:

        # Disable modules, they are not needed
        server.modules = (
        #   "mod_access",
        #   "mod_alias",
        #   "mod_compress",
        #   "mod_redirect",
        #       "mod_rewrite",
        )

        # Setup the directory to serve, this is actually symlink to web's home
        server.document-root        = "/var/www/lokki_futulokki/"
        server.upload-dirs          = ( "/var/cache/lighttpd/uploads" )
        server.errorlog             = "/var/log/lighttpd/error.log"
        server.pid-file             = "/var/run/lighttpd.pid"
        server.username             = "www-data"
        server.groupname            = "www-data"

        index-file.names            = ( "index.html" )

        url.access-deny             = ( "~", ".inc" )

        static-file.exclude-extensions = ( ".php", ".pl", ".fcgi" )

        ## Use ipv6 if available
        #include_shell "/usr/share/lighttpd/use-ipv6.pl"

        dir-listing.encoding        = "utf-8"

        compress.cache-dir          = "/var/cache/lighttpd/compress/"
        compress.filetype           = ( "application/x-javascript", "text/css", "text/html", "text/plain" )

        # This just reads /etc/mime.types and adds them to mime-types, there are quite a many filetypes
        include_shell "/usr/share/lighttpd/create-mime.assign.pl"
        include_shell "/usr/share/lighttpd/include-conf-enabled.pl"

        # Redirect anything to the root. Does not work if /css or other directory is accessed.
        server.error-handler-404   = "/index.html"

    This will basically setup minimum static file server where document-root is at
    /var/www/lokki_futulokki/.

    Start lighttpd with:

        sudo service lighttpd start

3. Create user web and some directories:

        adduser web
        su web
        cd
        mkdir futulokki-project
        cd futulokki-project
        git clone git@github.com:futurice/futulokki.git
        cd /var/www/
        # This linking could be avoided by configuring lighttpd's document root.
        ln -s /home/web/futulokki-project/lokki_futulokki

4. Install NodeJS, VLC and needed stuff

        sudo apt-get install screen vlc python-pip nodejs npm
        sudo pip install python-twitter
        cd ~/futulokki-project
        npm install minify

5. Setup VLC, at this point you should have Raspberry's MJPEG streamer running and SSH tunnel set.

        screen -S vlc
        vlc -I dummy http://localhost:2222/?action=stream --repeat --sout #transcode{vcodec=MJPG,vb=400,width=720,height=540}:duplicate{dst=std{access=http{mime=multipart/x-mixed-replace;boundary=--7b3cc56e5f51db803f790dad720ed50a},mux=mpjpeg,dst=:3000/webcam.mjpg}} -v

    --repeat parameter means that vlc will automatically reconnect to stream if it disconnects.

    Find more information about vlc's streaming: http://www.videolan.org/doc/videolan-howto/en/ch09.html


6. Install Paparazzo.js, which is NodeJS MJPEG proxy.

        cd ~/futulokki-project
        git clone https://github.com/wilhelmbot/Paparazzo.js.git
        cd Paparazzo.js
        npm install
        cd demo

    Edit server.coffee to:

        # Using the Paparazzo.js module

        Paparazzo = require '../src/paparazzo'
        http = require 'http'
        url = require 'url'

        paparazzo = new Paparazzo
            host: 'localhost'
            port: 3000
            path: '/webcam.mjpg'

        updatedImage = ''

        paparazzo.on "update", (image) =>
            updatedImage = image
            #console.log "Downloaded #{image.length} bytes"

        #paparazzo.on 'error', (error) =>
        #    console.log "Error: #{error.message}"

        paparazzo.start()

        http.createServer (req, res) ->
            data = ''
            path = url.parse(req.url).pathname

            if path == '/camera' and updatedImage?
                data = updatedImage
                #console.log "Will serve image of #{data.length} bytes"

            res.writeHead 200,
                'Content-Type': 'image/jpeg'
                'Content-Length': data.length

            res.write data, 'binary'
            res.end()
        .listen(8080)

    This is small modification which changes the serving port, removes debug printing and removes the error handler, this means that the NodeJS server will crash on error(which is now a good thing). Also the source of stream is changed so that stream provided by VLC at localhost is used.

    Edit start-paparazzo.sh:

        #!/bin/bash

        while true; do
            node bootstrap.js
            sleep 1
        done

    The paprazzo.js was not really stable.. This is why a bash loop hack was made.

    Now run the NodeJS server:

        screen -S node
        chmod +x start-paparazzo.sh
        ./start-paparazzo.sh

6. Now you should have the lighttpd running at port 80 and NodeJS at 8080.

7. Setup tweet fetching "backend"

    First you need a Twitter app, go to registration: https://dev.twitter.com/apps/new
    Generate auth tokens for the new app.

    Then edit /home/web/futulokki-project/config.json and add your twitter applications keys. Use config.json from the repository as an example.

    After that add tweet fetching to cron:

        crontab -e

    And add line:

        */2 * * * * python /home/web/futulokki-project/fetch_tweets.py /home/web/futulokki-project/lokki_futulokki/twitterapi/

    This will fetch latest tweets to twitterapi every two minutes.

    Twitter 1.1 API needs some authentication, this way users don't need to worry about the authing. The tweet fetching is done at backend.

8. Create deploy script

    Edit /home/web/futulokki-project/deploy.sh:

        #!/bin/bash

        # Clone latest
        git clone git@github.com:futurice/futulokki.git new_lokki_repository

        # Move latest in place and remove non-public from repository
        cp -r new_lokki_repository/* lokki_futulokki/
        cd lokki_futulokki
        rm -rf .git .gitignore README.md docs twitterapi config.json
        mkdir twitterapi
        cd ..

        # Put tweet backend into its place
        rm -rf py_twitter_package
        cd new_lokki_repository/twitterapi
        tar xvvf python-twitter-1.0.tar
        mv python-twitter-1.0 ../../py_twitter_package
        # Make the folder a python package
        touch ../../py_twitter_package/__init__.py
        mv fetch_tweets.py ../..
        cd ../..
        # Create initial tweet api
        python fetch_tweets.py lokki_futulokki/twitterapi/

        # Minify js and remove temporary directory
        ./node_modules/minify/bin/minify lokki_futulokki/js/main.js lokki_futulokki/js/main.js
        rm -rf new_lokki_repository

    python-twitter was quite bad library, I modified it a bit to get straight JSON from Twitter API. Therefore it's included in the repository.

    Add +x chmod:

        chmod +x deploy.sh

    Now when you have made changes to repository and want to deploy the changes, run:

        ./deploy.sh

    This will:

        1. Fetch latest code
        2. Copy it to lighttpd's document root
        3. Remove .git files and docs etc.
        4. Setup twitter api "backend" and fetch latest tweets
        5. Minify JS

    Remember to test the deployment at test environment!


# Useful links

- http://serverfault.com/questions/288137/how-to-stream-live-video-from-a-linux-server
