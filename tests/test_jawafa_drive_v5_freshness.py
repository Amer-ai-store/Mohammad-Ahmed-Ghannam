"""Offline tests of private Drive run selection. No network, credentials, data."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]/"tools"))
import jawafa_drive_readonly_verify as m

F=m.FOLDER_MIME
class FakeFiles:
    def __init__(self, nodes): self.nodes=nodes
    def list(self, **kwargs):
        parent=kwargs['q'].split("' in parents")[0].lstrip("'")
        return FakeResponse({'files':self.nodes.get(parent, [])})
    def get(self, **kwargs):
        for values in self.nodes.values():
            for v in values:
                if v['id']==kwargs['fileId']: return FakeResponse(v)
        return FakeResponse({})
class FakeResponse:
    def __init__(self,data): self.data=data
    def execute(self):return self.data
class FakeAPI:
    def __init__(self,nodes):self.nodes=nodes
    def files(self):return FakeFiles(self.nodes)


class RunDiscovery(unittest.TestCase):
    def nodes(self):
        return {
            'root': [{'id':'offsite', 'name':'Jawafa_Forensic_Offsite_Copy_20261112','mimeType':F},{'id':'old', 'name':'Hourly_v5_Historical_Archives','mimeType':F}],
            'offsite':[{'id':'exp','name':'Exports','mimeType':F}],
            'exp':[{'id':'hourly','name':'hourly-v5','mimeType':F}],
            'hourly':[{'id':'run11','name':'20261111-0100','mimeType':F},{'id':'run12','name':'20261112-0100','mimeType':F}],
        }
    def test_latest_actual_run(self):
        with patch.dict('os.environ',{'JAWAFA_DRIVE_RUN_FOLDER':''}):
            self.assertEqual(m.find_latest_run(FakeAPI(self.nodes()),'root')['name'],'20261112-0100')
    def test_only_known_subtree(self):
        nodes=self.nodes();nodes['old']=[{'id':'bogus','name':'20261119-0100','mimeType':F}]
        with patch.dict('os.environ',{'JAWAFA_DRIVE_RUN_FOLDER':''}):
            self.assertEqual(m.find_latest_run(FakeAPI(nodes),'root')['id'],'run12')
    def test_explicit_override_is_dated_folder(self):
        with patch.dict('os.environ',{'JAWAFA_DRIVE_RUN_FOLDER':'run11'}):
            self.assertEqual(m.find_latest_run(FakeAPI(self.nodes()),'root')['name'],'20261111-0100')
    def test_explicit_override_rejects_unrelated_folder(self):
        with patch.dict('os.environ',{'JAWAFA_DRIVE_RUN_FOLDER':'offsite'}):
            with self.assertRaisesRegex(ValueError,'invalid_explicit_run_folder'):
                m.find_latest_run(FakeAPI(self.nodes()),'root')
    def test_empty_run(self):
        with patch.dict('os.environ',{'JAWAFA_DRIVE_RUN_FOLDER':''}):
            with self.assertRaisesRegex(ValueError,'no_dated_v5_run_folder'):
                m.find_latest_run(FakeAPI({'root':[]}), 'root')
    def test_expected_day_validation(self):
        self.assertTrue(m._valid_expected_date('20261116'))
        self.assertFalse(m._valid_expected_date('20261360'))
        self.assertFalse(m._valid_expected_date('2026-11-16'))


if __name__=='__main__':unittest.main()
