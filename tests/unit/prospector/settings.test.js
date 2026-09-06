import { describe, expect, it } from 'vitest'
import { prepareSettingsForSave, prospectorErrorMessage } from '../../../src/lib/prospector/settings.js'
import { DEFAULT_SCORING_WEIGHTS } from '../../../src/lib/prospector/scoring.js'

const base = () => ({
  business_profile:{business:'Tada Wind',services:['drone',' vidéo promotionnelle ','drone'],positioning:'local',targetCustomers:[' hôtel '],preferredAreas:[],portfolio:[],contactInfo:{email:'contact@tada.test'},pitchNotes:''},
  reference_address:' Sarlat-la-Canéda ',reference_lat:null,reference_lng:null,radius_preferred_km:40,radius_max_km:100,min_score:40,
  priority_thresholds:{hot:80,good:60,consider:40,low:20},distance_bands:[{max:30,points:5},{max:60,points:3},{max:100,points:1}],
  enabled_categories:[],disabled_categories:[],followup_delays_days:[3,7,14],ai_model_simple:null,ai_model_complex:null,monthly_budget_usd:null,
  tone:' naturel ',channels:{email:true,instagram:true,linkedin:true,phone:true},scoring_weights:{...DEFAULT_SCORING_WEIGHTS},
})

describe('réglages Prospection', () => {
  it('prépare un payload limité, normalisé et sans modifier le formulaire', () => {
    const form=base(); form.id='evil'; const snapshot=structuredClone(form)
    const result=prepareSettingsForSave(form,base(),new Date('2026-09-05T10:00:00Z'))
    expect(result).not.toHaveProperty('id')
    expect(result.business_profile.services).toEqual(['drone','vidéo promotionnelle'])
    expect(result.reference_address).toBe('Sarlat-la-Canéda')
    expect(result.tone).toBe('naturel')
    expect(form).toEqual(snapshot)
  })
  it('convertit les valeurs de formulaire et versionne un barème modifié', () => {
    const form=base(); form.radius_preferred_km='50'; form.monthly_budget_usd='20.50'; form.scoring_weights.fit_tada_wind='20'; form.scoring_weights.geo_access='10'
    const result=prepareSettingsForSave(form,base(),new Date('2026-09-05T10:00:00Z'))
    expect(result.radius_preferred_km).toBe(50)
    expect(result.monthly_budget_usd).toBe(20.5)
    expect(result.scoring_weights.version).toBe('2026-09-05T10:00:00.000Z')
  })
  it.each([
    ['service vide',f=>f.business_profile.services=[]],['email invalide',f=>f.business_profile.contactInfo.email='oops'],
    ['rayons inversés',f=>f.radius_preferred_km=101],['coordonnées partielles',f=>f.reference_lat=44],
    ['catégorie contradictoire',f=>{f.enabled_categories=['hotel'];f.disabled_categories=['hotel']}],
    ['relances désordonnées',f=>f.followup_delays_days=[7,3]],['poids invalides',f=>f.scoring_weights.fit_tada_wind=99],
    ['portfolio invalide',f=>f.business_profile.portfolio=['javascript:alert(1)']],
  ])('rejette %s',(_,mutate)=>{const form=base();mutate(form);expect(()=>prepareSettingsForSave(form,base())).toThrow()})
  it('traduit les erreurs techniques sans exposer leur détail', () => {
    expect(prospectorErrorMessage({message:'SETTINGS_CONFLICT'})).toContain('autre session')
    expect(prospectorErrorMessage({code:'42501',message:'permission denied'})).toContain('session')
    expect(prospectorErrorMessage({message:'secret internal failure'})).not.toContain('secret')
  })
})
