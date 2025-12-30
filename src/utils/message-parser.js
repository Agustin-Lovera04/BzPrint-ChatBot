export function parseWebhookMessage(body) {
  const entry = body.entry?.[0]?.changes?.[0];
  if (!entry) return null;

  const value = entry.value;
  const message = value.messages?.[0];
  if (!message) return null;

  return {
    from: message.from,
    type: message.type,
    text: message.text?.body ?? null,

    buttonId: message.interactive?.button_reply?.id ?? null,
    listId: message.interactive?.list_reply?.id ?? null,

    document:
      message.type === "document" && message.document
        ? { filename: message.document.filename, mediaId: message.document.id }
        : null,

    image:
      message.type === "image" && message.image
        ? { mediaId: message.image.id, filename: "imagen.jpg" }
        : null,

    raw: message,
  };
}
