import { Expand, X } from 'lucide-react';
import { useState } from 'react';

export default function ChatMediaLightbox({
  kind,
  url,
  alt = 'Bijlage media',
  triggerClassName = '',
  mediaClassName = ''
}) {
  const [open, setOpen] = useState(false);

  if (!url || (kind !== 'image' && kind !== 'video')) {
    return null;
  }

  return (
    <>
      <button
        className={`chat-media-lightbox__trigger ${triggerClassName}`.trim()}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={kind === 'image' ? 'Bekijk afbeelding groter' : 'Bekijk video groter'}
      >
        {kind === 'image' ? (
          <img className={mediaClassName} src={url} alt={alt} />
        ) : (
          <video className={mediaClassName} src={url} playsInline muted preload="metadata" />
        )}
        <span className="chat-media-lightbox__hint">
          <Expand size={14} />
          Vergroot
        </span>
      </button>

      {open ? (
        <div className="chat-media-lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="chat-media-lightbox__surface" onClick={(event) => event.stopPropagation()}>
            <button className="chat-media-lightbox__close" type="button" onClick={() => setOpen(false)} aria-label="Sluiten">
              <X size={18} />
            </button>
            {kind === 'image' ? (
              <img className="chat-media-lightbox__media" src={url} alt={alt} />
            ) : (
              <video className="chat-media-lightbox__media" src={url} controls playsInline autoPlay />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
