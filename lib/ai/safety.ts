/**
 * When the Observer flags a credible crisis disclosure, the comedy
 * pipeline stops and the user gets a brief, humane response in their
 * language instead of satire.
 */
const SAFETY_RESPONSES: Record<string, string> = {
  en: `I'm not going to turn this one into a joke.

What you wrote sounds heavy, and it deserves a person, not a punchline. If you're in immediate danger, please contact local emergency services. In the US you can call or text 988 (Suicide & Crisis Lifeline). Elsewhere, findahelpline.com lists free, confidential support lines by country.

The editor will be here when you want to write about something else.`,
  ru: `Из этого я шутку делать не буду.

То, что вы написали, звучит тяжело, и здесь нужен человек, а не пуанта. Если есть непосредственная опасность — обратитесь в экстренные службы. Список бесплатных линий поддержки по странам: findahelpline.com.

Редактор будет здесь, когда захотите написать о чём-то другом.`,
  uk: `З цього я жарт робити не буду.

Те, що ви написали, звучить важко, і тут потрібна людина, а не пуанта. Якщо є безпосередня небезпека — зверніться до екстрених служб. В Україні працює Лінія запобігання самогубствам 7333. Список безкоштовних ліній підтримки: findahelpline.com.

Редактор буде тут, коли захочете написати про щось інше.`,
};

export function safetyResponse(language: string): string {
  return SAFETY_RESPONSES[language] ?? SAFETY_RESPONSES.en;
}
