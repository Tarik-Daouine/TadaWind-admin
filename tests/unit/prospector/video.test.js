import {it,expect} from 'vitest'
import {parseVideo} from '../../../src/lib/video.js'
it('accepts YouTube and Shorts URLs without accepting lookalike hosts',()=>{
  expect(parseVideo('https://youtu.be/abcdefghijk').provider).toBe('YouTube')
  expect(parseVideo('https://youtube.com/shorts/abcdefghijk').id).toBe('abcdefghijk')
  expect(parseVideo('https://youtube.com.attacker.invalid/watch?v=abcdefghijk')).toBeNull()
})
it('preserves the Vimeo unlisted access hash',()=>{
  expect(parseVideo('https://vimeo.com/123456789/abcdef1234').embed).toBe('https://player.vimeo.com/video/123456789?h=abcdef1234')
})
it.each(['javascript:alert(1)','https://user:password@vimeo.com/12345','https://vimeo.com/12345?h=\"onload=alert(1)','http://youtu.be/abcdefghijk'])('rejects unsafe URL %s',url=>expect(parseVideo(url)).toBeNull())
