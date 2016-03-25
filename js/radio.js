var radio = angular.module('radio', ['ngAnimate','ui.bootstrap']);

radio.factory('mpd', function($http) {
    return {
        sendCommand: function(cmd, args) {
            args = args || [];
            var params = { c: cmd };
            for (var i = 0; i < args.length; i++) {
                var key = 'a' + i;
                params[key] = args[i];
            }
            return $http.get('m.php', { params: params }).then(function(response) {
                return response.data;
            });
        }
    }
});

radio.controller('modal', function ($scope, $uibModalInstance, items) {
    $scope.items = items;
    $scope.selected = {
        item: $scope.items[0]
    };

    $scope.ok = function () {
        $uibModalInstance.close($scope.selected.item);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
});

radio.controller('dj', function ($scope, $http, $uibModal, $interval, mpd) {

    var statusTimeout = 3000;
    var progressTimeout = 500;
    var songId = 0;
    var statusFile = '/radio/mpd-status.json';
    var songFile = '/radio/mpd-song.json';
    var lastSongId;
    var songLength = 0;
    var songTime = 0;
    var i = 0;
    var elapsedGuess = 0;
    var elapsedReal = 0;
    var elapsed = 0;

    $scope.count = 1;

    $scope.getStatus = function() {
        $http.get(statusFile).success(function(data) {
            $scope.status = data;
            lastSongId = songId;
            songId = $scope.status.songid;
            elapsedReal = $scope.status.elapsed;

            if ($scope.status.songid != lastSongId) {
                $scope.getCurrentSong();
                $scope.getPlaylist();
            }
        });
        i++;
    };

    $scope.find = function (type, what) {
        var modalInstance = $uibModal.open({
            animation: false,
            size: 'lg',
            templateUrl: 'modal.html',
            controller: 'modal',
            resolve: {
                items: function () {
                    return mpd.sendCommand('find', [type, what]).then(function(data) {
                        return data;
                    });
                }
            }
        });

        modalInstance.result.then(function (selectedItem) {
            $scope.selected = selectedItem;
        }, function () {
            console.log('modal dismissed');
        });
    };

    $scope.getProgress = function() {
        var total = 0;
        var percent = 0;
        if (elapsedReal > 0) {
            elapsedGuess = elapsedReal;
            elapsedReal = 0;
        } else {
            elapsedGuess = parseFloat(elapsed) + (progressTimeout / 1000);
        }
        elapsed = elapsedGuess;
        if ($scope.song != null) {
            total = parseInt($scope.song.Time);
            percent = (elapsed / total) * 100;
        }
        $scope.elapsed = elapsed;
        $scope.total = total;
        $scope.percent = Math.round(percent);
    };

    $scope.isCurrentSong = function(file) {
        if (file.Id == songId) {
            return true;
        }
        return false;
    };

    $scope.getCurrentSong = function () {
        $http.get(songFile).success(function(data) {
            $scope.song = data;
        });
    };

    $scope.getPlaylist = function(timeout) {
        timeout = timeout || 500;
        setTimeout(function() {
            mpd.sendCommand('playlistinfo').then(function(data) {
                $scope.playlist = data;
            });
        }, timeout);
    }

    $scope.skip = function() {
        mpd.sendCommand('next');
        $scope.getStatus();
    };

    $scope.shuffle = function() {
        mpd.sendCommand('shuffle');
        $scope.getPlaylist();
    };

    $scope.crop = function() {
        mpd.sendCommand('crop');
        $scope.getPlaylist();
    };

    $scope.addRandom = function(num) {
        mpd.sendCommand('addRandomSong', [num]);
        $scope.getPlaylist(1020);
    };

    $scope.refresh = function() {
        $scope.count = 1;
        $scope.getStatus();
        $scope.getPlaylist();
    };

    $scope.moveUp = function(pos) {
        mpd.sendCommand('move', [pos, parseInt(pos) - 1]);
        $scope.getPlaylist();
    };

    $scope.moveDown = function(pos) {
        mpd.sendCommand('move', [pos, parseInt(pos) + 1]);
        $scope.getPlaylist();
    };

    $scope.play = function(pos) {
        mpd.sendCommand('play', [pos]);
        $scope.getStatus();
    };

    $scope.delete = function(pos) {
        mpd.sendCommand('delete', [pos]);
        $scope.getPlaylist();
    };

    $scope.getStatus();
    $scope.getProgress();
    $interval($scope.getStatus, statusTimeout);
    $interval($scope.getProgress, progressTimeout);

});
