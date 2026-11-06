"""Browser-free markup checks; these do not prove rendered layout or interaction."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Markup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []
        self.select_options = {}
        self.select = None
        self.group = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if tag == 'select':
            self.select = attrs.get('id')
            self.select_options[self.select] = []
        elif tag == 'optgroup':
            self.group = attrs.get('label')
        elif tag == 'option' and self.select:
            self.select_options[self.select].append((attrs.get('value'), self.group))

    def handle_endtag(self, tag):
        if tag == 'optgroup':
            self.group = None
        elif tag == 'select':
            self.select = None


class WorkspaceStructureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.markup = Markup()
        cls.markup.feed((ROOT/'public/index.html').read_text())
        cls.ids = {attrs['id']: (tag, attrs) for tag, attrs in cls.markup.elements if 'id' in attrs}

    def test_unique_ids_and_existing_script_targets(self):
        counts = Counter(attrs['id'] for _, attrs in self.markup.elements if 'id' in attrs)
        self.assertTrue(all(count == 1 for count in counts.values()))
        references = set(re.findall(r"\$\('([^']+)'\)", (ROOT/'public/app.js').read_text()))
        self.assertFalse(references - self.ids.keys(), 'Script refers to a missing control')

    def test_all_existing_actions_remain_buttons(self):
        for name in ['demoBtn','presentationBtn','panBtn','zoomOutBtn','zoomInBtn','fitBtn',
                     'runBtn','stepBtn','replayBtn','resetBtn','genMazeBtn',
                     'clearBtn','restoreBtn','saveBtn','loadBtn','refreshList','exportBtn','importBtn']:
            with self.subTest(action=name):
                self.assertEqual(self.ids[name][0], 'button')

    def test_form_controls_keep_accessible_names(self):
        labels = {attrs['for'] for tag, attrs in self.markup.elements if tag == 'label' and 'for' in attrs}
        for tag, attrs in self.markup.elements:
            if tag in ['input','select']:
                with self.subTest(control=attrs.get('id')):
                    self.assertTrue(attrs.get('aria-label') or attrs.get('aria-labelledby') or attrs.get('id') in labels)

    def test_navigation_and_accessibility_references_resolve(self):
        for _, attrs in self.markup.elements:
            for attribute in ['aria-labelledby','aria-describedby','for']:
                for target in attrs.get(attribute, '').split():
                    self.assertIn(target, self.ids)
            if attrs.get('href', '').startswith('#'):
                self.assertIn(attrs['href'][1:], self.ids)
        self.assertEqual(self.ids['gridWrap'][1]['tabindex'], '0')
        self.assertEqual(self.ids['gridWrap'][1]['role'], 'grid')
        self.assertEqual(self.ids['notice'][1]['role'], 'status')

    def test_all_drawing_tools_remain_named_toggles(self):
        tools = {attrs['data-tool']: attrs for _, attrs in self.markup.elements if 'data-tool' in attrs}
        self.assertEqual(set(tools), {'wall','erase','start','goal'})
        self.assertTrue(all('aria-pressed' in attrs and attrs.get('title') for attrs in tools.values()))

    def test_standalone_comparison_is_removed_but_paired_lab_remains(self):
        for removed in ['comparison','compareBtn','compareResults','compareTable']:
            self.assertNotIn(removed, self.ids)
        for retained in ['gridWrap','gridWrapRight','algo','algoRight','runBtn']:
            self.assertIn(retained, self.ids)

    def test_playback_progress_is_removed_but_computation_times_remain(self):
        for removed in ['progress','eventCount','playbackValue']:
            self.assertNotIn(removed, self.ids)
        self.assertFalse(any(tag == 'progress' for tag, _ in self.markup.elements))
        for retained in ['computeValue','computeValueRight']:
            self.assertIn(retained, self.ids)

    def test_core_choices_precede_optional_greedy_on_both_boards(self):
        for selector, core in [('algo',['BFS','A*','Dijkstra','DFS']),
                               ('algoRight',['A*','BFS','Dijkstra','DFS'])]:
            self.assertEqual(self.markup.select_options[selector],
                             [(name,'Core algorithms') for name in core] +
                             [('Greedy Best-First','More algorithms')])

    def test_branding_and_shortcut_cheat_sheet_are_removed(self):
        classes = {name for _, attrs in self.markup.elements for name in attrs.get('class','').split()}
        self.assertFalse(classes & {'brand','brand-mark','brand-subtitle','keyboard-hint'})
        self.assertFalse(any(tag == 'kbd' for tag, _ in self.markup.elements))

    def test_analysis_loads_before_the_controller_without_external_scripts(self):
        scripts = [attrs for tag, attrs in self.markup.elements if tag == 'script' and 'src' in attrs]
        sources = [attrs['src'] for attrs in scripts]
        self.assertIn('analysis.js', sources)
        self.assertIn('app.js', sources)
        self.assertIn('playback.js', sources)
        self.assertLess(sources.index('analysis.js'), sources.index('app.js'))
        self.assertLess(sources.index('playback.js'), sources.index('app.js'))
        for attrs in scripts:
            self.assertIn('defer', attrs)
            self.assertTrue((ROOT/'public'/attrs['src']).is_file())

    def test_simplified_setup_and_named_pair(self):
        for removed in ['rows','cols','genGrid','genType','genDensity','costVal','marker','speed','explanation','liveNarration']:
            self.assertNotIn(removed, self.ids)
        self.assertEqual(self.ids['gridWrapRight'][1]['role'], 'grid')
        self.assertEqual(self.ids['gridWrapRight'][1]['aria-readonly'], 'true')
        self.assertIn('algoRight', self.ids)
        for suffix in ['', 'Right']:
            for base in ['algo','algoName','algoTag','algoDescription','algoGuarantee','laneStatus',
                         'exploredValue','exploredHint','frontierValue','movesValue','movesHint','costValue','computeValue',
                         'peakValue','coverageValue','averageCostValue']:
                self.assertIn(base+suffix,self.ids)

    def test_map_feature_removed_and_maze_remains_visible(self):
        for name in ['mapModeBtn','mapPanel','mapTitle','streetMap0','streetMap1',
                     'streetAlgo0','streetAlgo1','mapRandomizeBtn']:
            self.assertNotIn(name, self.ids)
        self.assertNotIn('hidden', self.ids['mazePanel'][1])
        self.assertEqual(self.ids['skipWorkspace'][1]['href'], '#workspace')
        scripts = [attrs['src'] for tag, attrs in self.markup.elements if tag == 'script' and 'src' in attrs]
        self.assertEqual(scripts, ['analysis.js','playback.js','app.js'])
        self.assertFalse(any(attrs.get('href') == 'leaflet.css' for _, attrs in self.markup.elements))


if __name__ == '__main__':
    unittest.main(verbosity=2)
