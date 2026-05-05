# YOWLMAFFIA Email Templates

Use these in Supabase Auth:
- Magic Link
- Confirm Signup
- Reset Password
- Change Email Address

Style direction:
- deep black luxury layout
- purple borders with a blue glow
- elegant handwritten body text
- high contrast for mobile dark mode

## Magic Link / OTP

**Subject**

`Jouw YOWLMAFFIA inlogcode`

**Body**

```html
<div style="margin:0;padding:0;background:#050505;color:#f5f1ff;font-family:'Segoe Print','Bradley Hand','Snell Roundhand',cursive;">
  <div style="max-width:700px;margin:0 auto;padding:30px 18px;">
    <div style="border:1px solid #8b5cf6;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#0c0c0c 0%,#050505 100%);box-shadow:0 0 0 1px rgba(87,183,255,.08) inset, 0 26px 90px rgba(0,0,0,.58), 0 0 28px rgba(87,183,255,.12);">
      <div style="padding:30px 30px 18px;border-bottom:1px solid rgba(139,92,246,.28);background:linear-gradient(135deg,rgba(139,92,246,.12),rgba(87,183,255,.08),rgba(0,0,0,0));">
        <div style="font-family:Inter,Arial,sans-serif;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#c4b5fd;font-weight:800;margin-bottom:12px;">
          YOWLMAFFIA Account Management
        </div>
        <h2 style="margin:0;font-size:32px;line-height:1.08;color:#ffffff;font-family:Inter,Arial,sans-serif;">
          Interne inlogcode
        </h2>
      </div>

      <div style="padding:30px;">
        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Beste teamlid,
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Je hebt geprobeerd in te loggen op het interne YOWLMAFFIA-account.
          Gebruik onderstaande code om veilig verder te gaan met je aanmelding.
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Deze code is persoonlijk, tijdelijk en bedoeld voor eenmalig gebruik.
          De code is 15 minuten geldig.
        </p>

        <div style="margin:28px 0 26px;padding:24px;border-radius:20px;background:linear-gradient(180deg,#171717 0%,#090909 100%);border:1px solid #8b5cf6;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 0 24px rgba(87,183,255,.12);">
          <div style="font-family:Inter,Arial,sans-serif;font-size:12px;font-weight:800;letter-spacing:.26em;text-transform:uppercase;color:#c4b5fd;margin-bottom:10px;">
            Inlogcode
          </div>
          <div style="font-family:Inter,Arial,sans-serif;font-size:44px;line-height:1;font-weight:900;letter-spacing:.24em;color:#ffffff;">
            {{ .Token }}
          </div>
        </div>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Vul deze code alleen in op het scherm waar je je aanmelding afrondt.
          Deel deze code nooit met iemand anders.
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          YOWLMAFFIA zal je nooit vragen om je code door te sturen via chat, e-mail of schermdeling.
          Als jij deze inlogpoging zelf hebt gestart, kan je deze mail gewoon gebruiken.
        </p>

        <p style="margin:0;font-size:18px;line-height:1.85;color:#fff7ea;">
          Heb jij deze actie niet aangevraagd? Dan hoef je niets te doen en mag je deze mail negeren.
        </p>

        <div style="margin-top:30px;padding-top:18px;border-top:1px solid rgba(139,92,246,.26);font-size:16px;line-height:1.7;color:#ffffff;text-align:center;">
          Met vriendelijke groet,<br />
          Het YOWLMAFFIA TEAM
        </div>
      </div>
    </div>
  </div>
</div>
```

## Confirm signup / verification code

**Subject**

`Bevestig je YOWLMAFFIA-teamaccount`

**Body**

```html
<div style="margin:0;padding:0;background:#050505;color:#f5f1ff;font-family:'Segoe Print','Bradley Hand','Snell Roundhand',cursive;">
  <div style="max-width:700px;margin:0 auto;padding:30px 18px;">
    <div style="border:1px solid #8b5cf6;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#0c0c0c 0%,#050505 100%);box-shadow:0 0 0 1px rgba(87,183,255,.08) inset, 0 26px 90px rgba(0,0,0,.58), 0 0 28px rgba(87,183,255,.12);">
      <div style="padding:30px 30px 18px;border-bottom:1px solid rgba(139,92,246,.28);background:linear-gradient(135deg,rgba(139,92,246,.12),rgba(87,183,255,.08),rgba(0,0,0,0));">
        <div style="font-family:Inter,Arial,sans-serif;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#c4b5fd;font-weight:800;margin-bottom:12px;">
          YOWLMAFFIA Account Management
        </div>
        <h2 style="margin:0;font-size:32px;line-height:1.08;color:#ffffff;font-family:Inter,Arial,sans-serif;">
          Bevestig je teamaccount
        </h2>
      </div>

      <div style="padding:30px;">
        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Beste teamlid,
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Fijn dat je een intern YOWLMAFFIA-account hebt aangemaakt.
          Om je teamtoegang veilig te activeren, vragen we je om onderstaande code in te vullen in de app.
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Deze code is persoonlijk, tijdelijk en bedoeld voor eenmalig gebruik.
          De code is 15 minuten geldig.
        </p>

        <div style="margin:28px 0 26px;padding:24px;border-radius:20px;background:linear-gradient(180deg,#171717 0%,#090909 100%);border:1px solid #8b5cf6;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 0 24px rgba(87,183,255,.12);">
          <div style="font-family:Inter,Arial,sans-serif;font-size:12px;font-weight:800;letter-spacing:.26em;text-transform:uppercase;color:#c4b5fd;margin-bottom:10px;">
            Verificatiecode
          </div>
          <div style="font-family:Inter,Arial,sans-serif;font-size:44px;line-height:1;font-weight:900;letter-spacing:.24em;color:#ffffff;">
            {{ .Token }}
          </div>
        </div>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Vul deze code alleen in op het aanmeldscherm van de app.
          Deel deze code nooit met iemand anders.
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Als jij dit account zelf hebt aangemaakt, kan je deze mail gewoon gebruiken om je account te bevestigen.
          Heb jij deze registratie niet aangevraagd? Dan hoef je niets te doen en mag je deze mail negeren.
        </p>

        <div style="margin-top:30px;padding-top:18px;border-top:1px solid rgba(139,92,246,.26);font-size:16px;line-height:1.7;color:#ffffff;text-align:center;">
          Met vriendelijke groet,<br />
          Het YOWLMAFFIA TEAM
        </div>
      </div>
    </div>
  </div>
</div>
```

## Reset password / recovery code

**Subject**

`Stel je YOWLMAFFIA-teamwachtwoord opnieuw in`

**Body**

```html
<div style="margin:0;padding:0;background:#050505;color:#f5f1ff;font-family:'Segoe Print','Bradley Hand','Snell Roundhand',cursive;">
  <div style="max-width:700px;margin:0 auto;padding:30px 18px;">
    <div style="border:1px solid #8b5cf6;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#0c0c0c 0%,#050505 100%);box-shadow:0 0 0 1px rgba(87,183,255,.08) inset, 0 26px 90px rgba(0,0,0,.58), 0 0 28px rgba(87,183,255,.12);">
      <div style="padding:30px 30px 18px;border-bottom:1px solid rgba(139,92,246,.28);background:linear-gradient(135deg,rgba(139,92,246,.12),rgba(87,183,255,.08),rgba(0,0,0,0));">
        <div style="font-family:Inter,Arial,sans-serif;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#c4b5fd;font-weight:800;margin-bottom:12px;">
          YOWLMAFFIA Account Management
        </div>
        <h2 style="margin:0;font-size:32px;line-height:1.08;color:#ffffff;font-family:Inter,Arial,sans-serif;">
          Teamwachtwoord opnieuw instellen
        </h2>
      </div>

      <div style="padding:30px;">
        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Beste teamlid,
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          We hebben een aanvraag ontvangen om het wachtwoord van je interne YOWLMAFFIA-account opnieuw in te stellen.
          Gebruik onderstaande herstelcode om veilig een nieuw teamwachtwoord te kiezen.
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Deze code is persoonlijk en bedoeld voor eenmalig gebruik.
          Gebruik hem alleen op het herstel-scherm in de app.
        </p>

        <div style="margin:28px 0 26px;padding:24px;border-radius:20px;background:linear-gradient(180deg,#171717 0%,#090909 100%);border:1px solid #8b5cf6;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 0 24px rgba(87,183,255,.12);">
          <div style="font-family:Inter,Arial,sans-serif;font-size:12px;font-weight:800;letter-spacing:.26em;text-transform:uppercase;color:#c4b5fd;margin-bottom:10px;">
            Herstelcode
          </div>
          <div style="font-family:Inter,Arial,sans-serif;font-size:44px;line-height:1;font-weight:900;letter-spacing:.24em;color:#ffffff;">
            {{ .Token }}
          </div>
        </div>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Vul deze code in om een nieuw teamwachtwoord in te stellen.
          Deel deze code nooit met iemand anders.
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Als jij deze aanvraag niet hebt gestart, kan je deze mail gewoon negeren.
        </p>

        <p style="margin:0;font-size:18px;line-height:1.85;color:#fff7ea;">
          Voor extra veiligheid raden we aan om na het instellen van een nieuw wachtwoord niet opnieuw hetzelfde wachtwoord te gebruiken op andere diensten.
        </p>

        <div style="margin-top:30px;padding-top:18px;border-top:1px solid rgba(139,92,246,.26);font-size:16px;line-height:1.7;color:#ffffff;text-align:center;">
          Met vriendelijke groet,<br />
          Het YOWLMAFFIA TEAM
        </div>
      </div>
    </div>
  </div>
</div>
```

## Change email address

**Subject**

`Bevestig je YOWLMAFFIA-team e-mailadres`

**Body**

```html
<div style="margin:0;padding:0;background:#050505;color:#f5f1ff;font-family:'Segoe Print','Bradley Hand','Snell Roundhand',cursive;">
  <div style="max-width:700px;margin:0 auto;padding:30px 18px;">
    <div style="border:1px solid #8b5cf6;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#0c0c0c 0%,#050505 100%);box-shadow:0 0 0 1px rgba(87,183,255,.08) inset, 0 26px 90px rgba(0,0,0,.58), 0 0 28px rgba(87,183,255,.12);">
      <div style="padding:30px 30px 18px;border-bottom:1px solid rgba(139,92,246,.28);background:linear-gradient(135deg,rgba(139,92,246,.12),rgba(87,183,255,.08),rgba(0,0,0,0));">
        <div style="font-family:Inter,Arial,sans-serif;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#c4b5fd;font-weight:800;margin-bottom:12px;">
          YOWLMAFFIA Account Management
        </div>
        <h2 style="margin:0;font-size:32px;line-height:1.08;color:#ffffff;font-family:Inter,Arial,sans-serif;">
          Bevestig je team e-mailadres
        </h2>
      </div>

      <div style="padding:30px;">
        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Beste teamlid,
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Je hebt gevraagd om het e-mailadres van je interne account te wijzigen van
          <strong style="color:#ffffff;">{{ .Email }}</strong>
          naar
          <strong style="color:#ffffff;">{{ .NewEmail }}</strong>.
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Gebruik onderstaande code om deze wijziging te bevestigen in de YOWLMAFFIA-app.
        </p>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Deze code is persoonlijk en tijdelijk. Deel hem nooit met iemand anders.
          Als jij deze wijziging niet hebt aangevraagd, mag je deze mail gewoon negeren.
        </p>

        <div style="margin:28px 0 26px;padding:24px;border-radius:20px;background:linear-gradient(180deg,#171717 0%,#090909 100%);border:1px solid #8b5cf6;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 0 24px rgba(87,183,255,.12);">
          <div style="font-family:Inter,Arial,sans-serif;font-size:12px;font-weight:800;letter-spacing:.26em;text-transform:uppercase;color:#c4b5fd;margin-bottom:10px;">
            Bevestigingscode
          </div>
          <div style="font-family:Inter,Arial,sans-serif;font-size:44px;line-height:1;font-weight:900;letter-spacing:.24em;color:#ffffff;">
            {{ .Token }}
          </div>
        </div>

        <p style="margin:0 0 18px;font-size:18px;line-height:1.85;color:#fff7ea;">
          Open de app opnieuw, ga naar de instellingen en vul deze code in om je nieuwe team-e-mailadres te bevestigen.
        </p>

        <p style="margin:0;font-size:18px;line-height:1.85;color:#fff7ea;">
          Voor je veiligheid raden we aan om dit alleen te doen via de officiële YOWLMAFFIA-app.
        </p>

        <div style="margin-top:30px;padding-top:18px;border-top:1px solid rgba(139,92,246,.26);font-size:16px;line-height:1.7;color:#ffffff;text-align:center;">
          Met vriendelijke groet,<br />
          Het YOWLMAFFIA TEAM
        </div>
      </div>
    </div>
  </div>
</div>
```
