<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. The existing PostHog setup (SDK, provider, `initAnalytics`, typed `track()` wrapper) was already in place. This session filled in the gaps: six missing events were added across four files, environment variables were updated, and a PostHog dashboard with five insights was created.

## Events added this session

| Event | Description | File |
|---|---|---|
| `photo_removed` | User removes a photo from a location | `src/stores/projectStore.ts` |
| `project_loaded` | An existing project is restored from local storage on app start | `src/stores/projectStore.ts` |
| `transport_mode_changed` | User changes the transport mode for a segment | `src/components/editor/TransportSelector.tsx` |
| `playback_paused` | User pauses playback | `src/components/editor/EditorLayout.tsx` |
| `playback_completed` | Playback reaches the end naturally | `src/components/editor/EditorLayout.tsx` |
| `export_dialog_opened` | User opens the export dialog | `src/components/editor/TopToolbar.tsx` |

## Pre-existing events (already tracked)

`demo_loaded`, `editor_opened`, `project_created`, `location_added`, `location_removed`, `photo_added`, `photo_layout_opened`, `photo_layout_template_changed`, `route_exported`, `route_imported`, `playback_started`, `export_started`, `export_completed`, `export_failed`, `export_canceled`, `auth_succeeded`, `auth_failed`, `feedback_submitted`

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/373080/dashboard/1441228
- **Export funnel** (dialog → started → completed): https://us.posthog.com/project/373080/insights/2HY7GsX8
- **Playback completion rate** (started → completed): https://us.posthog.com/project/373080/insights/YgBbbkDP
- **Daily active editors (DAU)**: https://us.posthog.com/project/373080/insights/gGF3mFf0
- **Auth: signups & failures**: https://us.posthog.com/project/373080/insights/AO5KnOgY
- **Export success vs failure trend**: https://us.posthog.com/project/373080/insights/utmHo5Sv

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
