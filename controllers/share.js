var User = require('../models/user')
  , Badge = require('../models/badge')
  , Portfolio = require('../models/portfolio')
  , Group = require('../models/group')
  , reverse = require('../lib/router').reverse
  , configuration = require('../lib/configuration')
  , url = require('url')
  , _ = require('underscore')

exports.param = {
  groupUrl: function(request, response, next, url) {
    Group.findOne({url: url}, function(err, group) {
      if (err) {
        logger.error("Error pulling group: " + err);
        return response.send('Error pulling group', 500);
      }
      if (!group) {
        return response.send('Could not find group', 404);
      }
      Portfolio.findOne({group_id: group.get('id')}, function (err, portfolio) {
        if (err) next(err);
        if (portfolio) group.set('portfolio', portfolio);
        request.group = group;
        return next();
      });
    });
  }
}

var testStruct = {
  "title": "My Creative Commons Badges",
  "subtitle": "Some subtitle here",
  "preamble": "Nulla seitan excepteur, dreamcatcher culpa anim banh mi 3 wolf moon. Commodo sunt VHS flexitarian gastropub craft beer chambray, mlkshk stumptown biodiesel mollit organic nisi. Butcher sapiente direct trade velit, aute dolore vero. Truffaut kogi 3 wolf moon, forage carles ennui elit culpa typewriter portland DIY locavore. Terry richardson DIY hella delectus tofu. Non ex fap, sriracha lo-fi aute ethnic mumblecore cupidatat bushwick you probably haven't heard of them. Cred odio direct trade sed, aliquip four loko cardigan occaecat marfa beard anim letterpress.",
  "stories": {
    "7" : "Mollit aliquip anim irony, mlkshk small batch esse laborum tofu eiusmod synth cupidatat art party typewriter. Adipisicing nulla banksy quis kogi. Pour-over quinoa carles sint DIY, occaecat gastropub synth cardigan occupy truffaut readymade cosby sweater etsy. Beard food truck velit pinterest organic post-ironic, truffaut +1 gentrify eu. Street art locavore DIY authentic. Semiotics terry richardson godard pinterest letterpress est, irure occaecat kogi. Small batch four loko williamsburg lomo odd future pop-up.",
    "8" : "Butcher raw denim ex occaecat, hella consectetur pork belly ut portland freegan. Occupy enim wolf, ea yr sunt mlkshk culpa fugiat echo park sapiente salvia fap single-origin coffee. Excepteur tempor fixie, ennui thundercats do kale chips food truck american apparel voluptate lo-fi bushwick. Accusamus ennui tumblr, high life godard small batch letterpress dolor keytar est culpa labore. Typewriter fingerstache helvetica, anim eu american apparel four loko. Mlkshk velit brunch sint, fap aliqua 8-bit commodo odio cosby sweater enim quis. Cardigan squid cosby sweater 8-bit salvia, helvetica mustache odd future cillum sriracha irure reprehenderit hella.",
    "10" : "Aliqua nesciunt sed, pickled dolor pariatur butcher mcsweeney's four loko consectetur. Hoodie magna banh mi put a bird on it, fanny pack adipisicing fap hella nostrud reprehenderit terry richardson. Truffaut delectus odd future, do VHS high life Austin before they sold out consectetur typewriter four loko voluptate umami. Wolf umami laboris assumenda. Portland consequat twee pinterest, occaecat assumenda deserunt aliquip narwhal banh mi lomo polaroid gluten-free readymade sartorial. Selvage craft beer delectus raw denim twee, small batch kogi leggings commodo beard ullamco four loko narwhal nesciunt cosby sweater. Echo park pickled pork belly organic retro bespoke.",
    "9" : "Mollit aliquip anim irony, mlkshk small batch esse laborum tofu eiusmod synth cupidatat art party typewriter. Adipisicing nulla banksy quis kogi. Pour-over quinoa carles sint DIY, occaecat gastropub synth cardigan occupy truffaut readymade cosby sweater etsy. Beard food truck velit pinterest organic post-ironic, truffaut +1 gentrify eu. Street art locavore DIY authentic. Semiotics terry richardson godard pinterest letterpress est, irure occaecat kogi. Small batch four loko williamsburg lomo odd future pop-up."
  }
};

exports.editor = function (request, response) {
  var user, group = request.group
  if (!(user = request.user)) return response.send('nope', 403);
  if (user.get('id') !== group.get('user_id')) return response.send('nope', 403);
  function prepareText (txt) { txt = txt||''; return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '</p><p>'); }
  var portfolio = group.get('portfolio') || new Portfolio({group_id: group.get('id'), title: group.get('name'), stories:{}});
  console.dir(portfolio);
  
  var badgeById = {};
  request.group.getBadgeObjects(function (err, badges) {
    var badgesWithStories = _.map(badges, function modbadges (badge) {
      var id = badge.get('id')
        , story = portfolio.get('stories')[id]
        , body = badge.get('body')
        , origin = body.badge.issuer.origin
        , criteria = body.badge.criteria
        , evidence = body.evidence;
      if (criteria[0] === '/') body.badge.criteria = origin + criteria;
      if (evidence && evidence[0] === '/') body.evidence = origin + evidence;
      badgeById[id] = badge;
      badge.set('_userStory', story)
      return badge;
    });
    portfolio.group = group;
    portfolio.badges = badgesWithStories;
    portfolio.preamble = prepareText(portfolio.get('preamble'));
    response.render('portfolio-editor', {
      csrfToken: request.session._csrf,
      portfolio: portfolio
    });
  });
};

// #TODO: un-stupid this.
exports.show = function (request, response, next) {
  var user, group = request.group
  var portfolio = group.get('portfolio')
  if (!portfolio) return response.send('no portfolio :(', 404);
  function prepareText (txt) { txt = txt||''; return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '</p><p>'); }
  var badgeById = {};
  request.group.getBadgeObjects(function (err, badges) {
    var badgesWithStories = _.map(badges, function modbadges (badge) {
      var id = badge.get('id')
        , story = portfolio.get('stories')[id]
        , body = badge.get('body')
        , origin = body.badge.issuer.origin
        , criteria = body.badge.criteria
        , evidence = body.evidence;
      if (criteria[0] === '/') body.badge.criteria = origin + criteria;
      if (evidence && evidence[0] === '/') body.evidence = origin + evidence;
      badgeById[id] = badge;
      badge.set('_userStory', story)
      return badge;
    });
    portfolio.badges = badgesWithStories;
    portfolio.preamble = prepareText(portfolio.get('preamble'));
    response.render('portfolio', portfolio);
  });
};

exports.createOrUpdate = function (request, response) {
  var attributes = request.body;
  delete attributes._csrf
  var portfolio = new Portfolio(attributes);
  portfolio.save(function (err, p) {
    console.dir(err);
    console.dir(p);
    response.redirect(request.url, '303');
  })
};
