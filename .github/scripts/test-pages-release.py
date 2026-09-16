import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


prepare = module('prepare-pages-release').prepare
validate = module('check-pages-artifact').validate
verify = module('verify-preview-release').verify
SOURCE = 'a' * 40
RELEASE = 'b' * 40


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.source = root / 'build'
        self.target = root / 'release'
        self.source.mkdir()
        self.target.mkdir()
        (self.source / 'index.html').write_text('<script src="/arranger-demo/assets/main.js"></script>')
        (self.source / 'assets').mkdir()
        (self.source / 'assets/main.js').write_text('/* compiled app */')
        (self.target / '.git').mkdir()
        (self.target / '.git/config').write_text('retained Git metadata')
        (self.target / 'obsolete.js').write_text('old asset')

    def test_preparation_preserves_git_replaces_assets_and_records_source(self):
        prepare(self.source, self.target, SOURCE)
        self.assertEqual((self.target / '.git/config').read_text(), 'retained Git metadata')
        self.assertFalse((self.target / 'obsolete.js').exists())
        self.assertEqual((self.target / 'assets/main.js').read_bytes(), (self.source / 'assets/main.js').read_bytes())
        self.assertEqual(json.loads((self.target / 'deployment.json').read_text())['source_sha'], SOURCE)
        (self.target / '.git/config').unlink()
        (self.target / '.git').rmdir()
        validate(self.target, 'arranger-demo')

    def test_bad_build_is_rejected_before_replacing_release(self):
        (self.source / 'assets/main.js.map').write_text('{}')
        with self.assertRaises(ValueError):
            prepare(self.source, self.target, SOURCE)
        self.assertTrue((self.target / 'obsolete.js').exists())

    def test_nonnumeric_source_ref_and_overlapping_directories_rejected(self):
        with self.assertRaises(ValueError):
            prepare(self.source, self.target, 'main')
        with self.assertRaises(ValueError):
            prepare(self.source, self.source, SOURCE)

    def test_nojekyll_exception_does_not_allow_other_hidden_files_or_symlinks(self):
        (self.source / '.nojekyll').touch()
        validate(self.source, 'arranger-demo')
        (self.source / '.env').write_text('not publishable')
        with self.assertRaises(ValueError):
            validate(self.source, 'arranger-demo')
        (self.source / '.env').unlink()
        (self.source / '.nojekyll').unlink()
        (self.source / '.nojekyll').symlink_to(self.source / 'index.html')
        with self.assertRaises(ValueError):
            validate(self.source, 'arranger-demo')

    def promotion_api(self, path, state='success', ancestry='ahead'):
        if '/compare/' in path:
            return {'status': ancestry}
        if '/statuses?' in path:
            return [{'state': state}]
        return [{'id': 1}]

    def test_promotion_requires_successful_development_deployment(self):
        prepare(self.source, self.target, SOURCE)
        verify(self.target, RELEASE, self.promotion_api)
        with self.assertRaises(ValueError):
            verify(self.target, RELEASE, lambda path: self.promotion_api(path, state='failure'))
        with self.assertRaises(ValueError):
            verify(self.target, RELEASE, lambda path: self.promotion_api(path, ancestry='diverged'))

    def test_old_or_feature_branch_manifest_cannot_be_promoted(self):
        prepare(self.source, self.target, SOURCE)
        manifest_path = self.target / 'deployment.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['source_ref'] = 'feat/performance-loop-mode'
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):
            verify(self.target, RELEASE, self.promotion_api)


if __name__ == '__main__':
    unittest.main()
