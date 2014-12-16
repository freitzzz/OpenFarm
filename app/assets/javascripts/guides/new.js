openFarmApp.directive('formChecker', function(){
  return {
    // scope: {
    //   'formId': '=',
    //   'formStage': '='
    // },
    require: '^form',
    link: function(scope, element, attr){
      // loop through each stage
      var rootParent = scope.$parent.$parent.$parent;

      scope.$watch('$parent.stage', function(){
        var allDone = [];
        rootParent.stages.forEach(function(stage){
          if (stage.selected){
            stage.where.forEach(function(opt){
              if (opt.selected){
                stage.edited = true;
              }
            });
            stage.light.forEach(function(opt){
              if (opt.selected){
                stage.edited = true;
              }
            });
            stage.soil.forEach(function(opt){
              if (opt.selected){
                stage.edited = true;
              }
            });
            // Point the next step button to the next
            // stage.

            allDone.push(stage.edited ? true : false);
          }
        });
        var tracker = true;
        allDone.forEach(function(isDone){
          if (!isDone){
            tracker = false;
          }
        });

        rootParent.stageThreeTracker = tracker;
      }, true);

    }
  };
});

openFarmApp.directive('stageButtons', [
  function stageButtons(){
    return {
      restrict: 'A',
      scope: {
          abledBool: '&',
          nextFunction: '=',
          processing: '='
      },
      controller: ['$scope', '$element', '$attrs',
       function ($scope, $element, $attrs){
        // Takes in attributes and set them to the appropriate
        // variable on the local scope.
        $scope.$watch('processing', function(){
          if ($scope.processing === true){
            $scope.disabledText = 'This may take some time';
          }
        });
        $scope.abledText = $attrs.abledText || 'Continue';
        $scope.disabledText =
          $attrs.disabledText || 'You can\'t continue yet.';
        $scope.cancelText = $attrs.cancelText || 'Cancel.';
        $scope.cancelUrl = $attrs.cancelUrl || '/';
        $scope.backText = $attrs.backText || undefined;

        $scope.previousStep = $scope.$parent.previousStep;
        $scope.nextStep = $scope.nextFunction || $scope.$parent.nextStep;
      }],
      templateUrl: '/assets/templates/_stage_buttons.html'
    };
}]);

openFarmApp.controller('newGuideCtrl', ['$scope', '$http', '$filter',
  function newGuideCtrl($scope, $http, $filter) {
  $scope.alerts = [];
  $scope.crops = [];
  $scope.step = 1;
  $scope.crop_not_found = false;
  $scope.addresses = [];
  $scope.stages = [];
  $scope.hasEdited = [];

  // What's a new guide.
  $scope.newGuide = {
    name: '',
    crop: undefined,
    overview: '',
    selectedStages: [],
    exists: false,
    stages: [],
    practices: [
      {slug: 'organic', label: 'Organic', selected: false},
      {slug: 'permaculture', label: 'Permaculture', selected: false},
      {slug: 'conventional', label: 'Conventional', selected: false},
      {slug: 'hydroponic', label: 'Hydroponic', selected: false},
      {slug: 'intensive', label: 'Intensive', selected: false}
    ]
  };



  $scope.$watch('newGuide.stages', function(){
    $scope.newGuide.selectedStages = [];
    var stages = $scope.newGuide.stages;
    if (stages){
      var lastSelectedIndex = null;
      stages.forEach(function(item, index){
          if (item.selected){
            item.originalIndex = index;
            if (lastSelectedIndex !== null){
              item.lastSelectedIndex = lastSelectedIndex;
              stages[lastSelectedIndex].nextSelectedIndex = index;
            }

            $scope.newGuide.selectedStages.push(item);
            lastSelectedIndex = index;
          }
        });
    }

    $scope.newGuide.selectedStages.sort(function(a, b){
      return a.order > b.order;
    });
  }, true);

  $scope.$watch('step', function(afterValue){
    if (afterValue === 3){
      var selectedSet = false;
      $scope.newGuide.selectedStages.forEach(function(stage){
        if (stage.selected && !selectedSet){
          // hacked hack is a hack
          $scope.newGuide.stages[stage.originalIndex].editing = true;
          selectedSet = true;
        } else {
          $scope.newGuide.stages[stage.originalIndex].editing = false;
        }
      });
    }
  });

  var getStages = function(){
    $http.get('/api/stage_options/')
      .success(function(response){
        var stageWhere = ['Potted', 'Outside', 'Greenhouse', 'Indoors'];
        var stageLight = ['Full Sun', 'Partial Sun', 'Shaded', 'Darkness'];
        var stageSoil = ['Potting', 'Loam',
                         'Sandy Loam', 'Clay Loam',
                         'Sand', 'Clay'];
        $scope.stages = response.stage_options;
        $scope.stages = $filter('orderBy')($scope.stages, 'order');
        // Trickery to make sure the existing stages don't get
        // overwritten
        $scope.stages.forEach(function(item){
          item.selected = false;

          // loop over the existing stages.
          $scope.newGuide.stages.forEach(function(d){
            if (d.name === item.name){
              // And copy over the relevant stuff.
              item.selected = true;
              item.exists = true;
              item._id = d._id;

              item.where = $scope.buildStageDetails(stageWhere,
                                                    d.environment || []);
              item.light = $scope.buildStageDetails(stageLight,
                                                    d.light || []);
              item.soil = $scope.buildStageDetails(stageSoil,
                                                   d.soil || []);
            }
          });
          // TODO: The below probably needs to be broken out
          // and made *way* more dynamic.
          if (!item.where){
            item.where = $scope.buildStageDetails(stageWhere, []);
          }
          if (!item.light){
            item.light = $scope.buildStageDetails(stageLight, []);
          }
          if (!item.soil){
            item.soil = $scope.buildStageDetails(stageSoil, []);
          }
          return item;
        });

        $scope.newGuide.stages = $scope.stages;
      })
      .error(function(response, code){
        $scope.alerts.push({
          msg: code + ' error. We had trouble fetching all stage options.',
          type: 'warning'
        });
      });
  };

  if (getIDFromURL('guides') && getIDFromURL('guides') !== 'new'){
    $http.get('/api/guides/' + getIDFromURL('guides'))
      .success(function(r){
        $scope.newGuide.exists = true;
        $scope.newGuide._id = r.guide._id;
        $scope.newGuide.featured_image = r.guide.featured_image;
        $scope.s3upload = r.guide.featured_image;
        $scope.newGuide.name = r.guide.name;

        if (r.guide.practices){
          $scope.newGuide.practices.forEach(function(d){
            if (r.guide.practices.indexOf(d.slug) !== -1){
              d.selected = true;
            }
          });
        }

        if (r.guide.stages){
          r.guide.stages.forEach(function(d){
            d.exists = true;
            $scope.newGuide.stages.push(d);
          });
        }

        getStages();

        processCropID(r.guide.crop_id);
      })
      .error(function(r, e){
        $scope.alerts.push({
          msg: e,
          type: 'alert'
        });
        console.log(r, e);
      });
  } else {
    getStages();
  }

  var processCropID = function(crop_id) {
    if (crop_id){
      $http.get('/api/crops/' + crop_id)
        .success(function(r){
          // console.log(crop);
          $scope.newGuide.crop = r.crop;
          $scope.query = r.crop.name;
        })
        .error(function(r, e){
          $scope.alerts.push({
            msg: e,
            type: 'alert'
          });
          console.log(r, e);
        });
    }
  };

  processCropID(getUrlVar('crop_id'));

  //Typeahead search for crops
  $scope.search = function () {
    // be nice and only hit the server if
    // length >= 3
    if ($scope.query.length >= 3){
      $http({
        url: '/api/crops',
        method: "GET",
        params: {
          query: $scope.query
        }
      }).success(function (response) {
        if (response.crops.length){
          $scope.crops = response.crops;
        } else {
          $scope.crop_not_found = true;
        }
      }).error(function (response, code) {
        $scope.alerts.push({
          msg: code + ' error. Could not retrieve data from server. Please try again later.',
          type: 'warning'
        });
      });
    }
  };

  //Gets fired when user selects dropdown.
  $scope.cropSelected = function ($item, $model, $label) {
    $scope.newGuide.crop = $item;
    $scope.crop_not_found = false;
    $scope.newGuide.crop.description = '';
  };

  $scope.createCrop = function(){
    window.location.href = '/crops/new/?name=' + $scope.query;
  };

  $scope.nextStep = function(){
    $scope.step += 1;
  };

  $scope.previousStep = function(){
    $scope.step -= 1;
  };

  $scope.nextStage = function(index){
    $scope.editSelectedStage($scope.stages[index]);
  };

  $scope.editSelectedStage = function(stage){
    $scope.newGuide.selectedStages.forEach(function(item){
      item.editing = false;
      if (stage === item){
        item.editing = true;
      }
    });
  };

  $scope.buildStageDetails = function(array, selectedArray){
    var returnArray = [];
    array.forEach(function(d){
      var obj = {
        slug: d.toLowerCase().replace(/ /g,'_').replace(/[^\w-]+/g,''),
        label: d,
        selected: selectedArray.indexOf(d) === -1 ? false : true,
      };
      returnArray.push(obj);
    });
    return returnArray;
  };

  // The submit process.
  // Get the practices and clean them up.
  // Set up the parameters.
  // Post! & forward if successful

  $scope.submitForm = function () {
    $scope.newGuide.sending = true;
    var practices = [];
    angular.forEach($scope.newGuide.practices, function(value, key){
      if (value.selected){
        practices.push(value.slug);
      }
    }, practices);
    var params = {
      name: $scope.newGuide.name,
      crop_id: $scope.newGuide.crop._id,
      overview: $scope.newGuide.overview || null,
      location: $scope.newGuide.location || null,
      featured_image: $scope.newGuide.featured_image || null,
      practices: practices
    };
    if (params.featured_image === '/assets/leaf-grey.png'){
      params.featured_image = null;
    }
    if ($scope.newGuide._id){
      // In this case the guide already existed,
      // so we need to put, not to post.
      params._id = $scope.newGuide._id;
      $http.put('/api/guides/' + params._id + '/', params)
        .success(function(response){
          $scope.sendStages(response);
        })
        .error(function(response, code){
          console.log(response, code);
          $scope.alerts.push({
            msg: response.error,
            type: 'alert'
          });
        });
    } else {
      $http.post('/api/guides/', params)
        .success(function (r) {
          $scope.sendStages(r);
        })
        .error(function (r) {
          $scope.alerts.push({
            msg: r.error,
            type: 'alert'
          });
        });
    }
  };

  $scope.sendStages = function(r){
    var guide = r.guide;
    $scope.newGuide._id = r.guide._id;
    $scope.sent = 0;

    $scope.newGuide.stages.forEach(function(stage){
      var stageParams = {
        name: stage.name,
        images: [stage.featured_image],
        guide_id: guide._id,
        stage_length: stage.length || null,
        environment: stage.where.filter(function(s){
            return s.selected;
          }).map(function(s){
            return s.label;
          }) || null,
        soil: stage.soil.filter(function(s){
            return s.selected;
          }).map(function(s){
            return s.label;
          }) || null,
        light: stage.light.filter(function(s){
            return s.selected;
          }).map(function(s){
            return s.label;
          }) || null
      };

      // Go through all the possible changes on
      // each stage.
      if (stage.selected && !stage.exists){
        $http.post('/api/stages/', stageParams)
          .success(function(){
            $scope.sent ++;
            stage.sent = true;
          })
          .error(function(r){
            $scope.alerts.push({
              msg: r.error,
              type: 'alert'
            });
          });
      } else if (stage.selected && stage.exists){
        console.log(stageParams.images);
        $http.put('/api/stages/' + stage._id + '/', stageParams)
          .success(function(){
            stage.sent = true;
            $scope.sent ++;
          })
          .error(function(r){
            $scope.alerts.push({
              msg: r.error,
              type: 'alert'
            });
          });
      } else if (stage.exists){
        $http.delete('/api/stages/' + stage._id + '/')
          .success(function(){
            stage.sent = true;
            $scope.sent ++;
          })
          .error(function(r){
            $scope.alerts.push({
              msg: r.error,
              type: 'alert'
            });
          });
      }
    });
  };

  // Only redirect when everything is done processing.
  $scope.$watch('newGuide.stages', function(d){
    var updatedNum = 0;
    $scope.newGuide.stages.forEach(function(stage){
      if (stage.selected || stage.exists){
        updatedNum++;
      }
    });
    if (updatedNum === $scope.sent){
      window.location.href = '/guides/' + $scope.newGuide._id + '/';
    }
  }, true);

  // Any function returning a promise object can be used to load
  // values asynchronously

  $scope.cancel = function(path){
    window.location.href = path || '/';
  };
}]);
