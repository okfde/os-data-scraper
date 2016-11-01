/*

 Web-Scraper for:

 http://www.europe-en-france.gouv.fr/Rendez-vous-compte/Projets-exemplaires?thematique=0&region=0&fonds=0&mot-cle=Mot%28s%29+cl%C3%A9%28s%29&annee=0&valider=Valider
 */

var scrapyard = require("scrapyard");
var async = require("async");
var fs = require("fs");
var scraper = new scrapyard({
	debug: true,
	retries: 5,
	connections: 10,
	cache: '../../local/cache',
	bestbefore: "6000min"
});

var allitems = [];
var scrapeItem = function (item, next) {
	console.log('scraping profile', item._source);
	scraper({
			url: item._source,
			method: "GET",
			type: "html",
			encoding: "utf-8"
		},
		function (err, $) {
			if (err) return console.error(err);
			var applyProp = function (s) {
				var parts = s.split(':');
				item[parts[0].trim().toLowerCase().replace(/ /g, '_').replace(/'/g, '_')] = parts.slice(1).join(':').trim();
			};

			var row = $('#prj_quote .line_one .simple');
			applyProp('Annee: ' + $(row[0]).text());
			applyProp('Fond: ' + $(row[1]).text());
			applyProp('Fond Coût: ' + $(row[2]).text());
			applyProp('Région: ' + $(row[3]).text());
			applyProp('Titre: ' + $('#prj_quote .line_two').text());


			// applyProp('Titre: ' + $('#prj_quote .line_three').text());
			var sl = $('#prj_quote .line_three').text().trim().replace(/\t/g, '').split('\n').map(function (s) {
				return s.trim();
			}).filter(function (s) {
				return s.length > 0;
			});
			for (var i = sl.length - 1; i >= 1; i--) {
				if (sl[i].indexOf('Bénéficiaire :') < 0) {
					sl[i - 1] = sl[i - 1] + ' ' + sl[i];
					sl[i] = '';
				}
			}
			sl = sl.filter(function (s) {
				return s.length > 0;
			});
			sl.forEach(applyProp);


			$('#t_one .p2 li').each(function (i, elem) {
				applyProp($(elem).text());
			});
			allitems.push(item);
			// console.log(JSON.stringify(item, null, '\t'));
			next();
		});
};

var scrapePage = function (page) {
	console.log('scraping page', 'http://www.europe-en-france.gouv.fr/Rendez-vous-compte/Projets-exemplaires/(offset)/' + page + '/(viewtheme)/0/(viewregion)/0/(viewfonds)/0/(annee)/0');
	scraper(
		{
			url: 'http://www.europe-en-france.gouv.fr/Rendez-vous-compte/Projets-exemplaires/(offset)/' + page + '/(viewtheme)/0/(viewregion)/0/(viewfonds)/0/(annee)/0',
			method: "GET",
			type: "html",
			encoding: "utf-8"
		}
		, function (err, $) {
			if (err) return console.error(err);
			var list = $('.onglet-carte-list .cam_header .cam_btn1 a');
			var items = [];
			list.each(function (i, elem) {
				$a = $(elem);
				var o = {};
				var url = $a.attr('href');
				if (url) {
					o._source = 'http://www.europe-en-france.gouv.fr' + url;
					items.push(o);
				}
			});
			async.forEachSeries(items, scrapeItem, function () {
				if (items.length > 0) {
					return scrapePage(page + 5);
				}
				fs.writeFileSync('data.json', JSON.stringify(allitems, null, '\t'));
				console.log('done');
			})
		});
};

scrapePage(0);
