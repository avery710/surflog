/**
 * What the model is told. Skills are plain descriptions plus a rule for
 * when not to guess. Kept here so another tagger can reuse the same words.
 */

export const RIDE_PROMPT = `You are watching a surf session sampled at about 1 frame per second.
Find each ride: from when the surfer catches the wave and stands, or tries to, until they kick out, fall, or the wave ends.

A ride is actually riding a wave. Paddling, sitting, swimming, and walking are not rides.

Return JSON only, no other text:
{ "rides": [ { "startSec": number, "endSec": number } ] }
Times are seconds from the start of this video. If there are no rides, return { "rides": [] }.`;

export const SKILL_PROMPT = `You are watching one surf ride, sampled at about 5 frames per second.
Split it into skill segments.

Skills, in plain words:
- takeoff: the surfer pops up or stands as they catch the wave. It is short and at the start of a ride.
- bottom_turn: a turn at the bottom of the wave that redirects the board back up the face.
- trim: riding along the open face in a steady line, not a hard turn.
- cutback: a turn back toward the whitewater or the pocket of the wave.
- other: part of the ride that is a skill moment but not one of those four.
- not_a_ride: the surfer is not riding (paddling, sitting, swimming, walking, or no surfer on a wave).

If you are not sure a moment is a ride, use not_a_ride. If it is a ride but you cannot tell the skill, use other and set confidence below 0.5. Do not guess a specific skill when you are unsure.

Return JSON only, no other text:
{ "segments": [ { "skill": string, "startSec": number, "endSec": number, "confidence": number } ] }
Times are seconds from the start of this clip. confidence is from 0 to 1.`;
