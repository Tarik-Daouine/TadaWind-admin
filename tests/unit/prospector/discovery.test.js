import {describe,expect,it} from 'vitest'
import {buildOverpassQuery,parseOverpassResponse} from '../../../supabase/functions/_shared/prospector/discovery.js'

describe('découverte OpenStreetMap',()=>{
  it('construit uniquement des requêtes issues des catégories autorisées',()=>{
    const query=buildOverpassQuery({lat:44.89,lng:1.21,radiusKm:40,categories:['hotels','restaurants','hotels']})
    expect(query).toContain('around:40000,44.89,1.21')
    expect(query.match(/tourism/g)).toHaveLength(1)
    expect(()=>buildOverpassQuery({lat:44.89,lng:1.21,radiusKm:40,categories:['hotels"];out;']})).toThrow('INVALID_DISCOVERY_CATEGORIES')
  })

  it('transforme les nœuds et chemins en candidats bornés et dédupliqués',()=>{
    const result=parseOverpassResponse({elements:[
      {type:'node',id:1,lat:44.1,lon:1.2,tags:{name:'Hôtel Test',tourism:'hotel','addr:city':'Sarlat',website:'hotel.test','contact:phone':'05 53 00 00 00'}},
      {type:'node',id:1,lat:44.1,lon:1.2,tags:{name:'Doublon',tourism:'hotel'}},
      {type:'way',id:2,center:{lat:44.2,lon:1.3},tags:{name:'Le Restaurant',amenity:'restaurant','contact:website':'javascript:alert(1)'}},
      {type:'node',id:3,tags:{name:'Sans coordonnées',tourism:'hotel'}},
    ]})
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(expect.objectContaining({name:'Hôtel Test',category:'hotels',city:'Sarlat',website:'https://hotel.test/',lat:44.1,lng:1.2}))
    expect(result[1].website).toBeNull()
    expect(result[1].source_url).toBe('https://www.openstreetmap.org/way/2')
  })
})
