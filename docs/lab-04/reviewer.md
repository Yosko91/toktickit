# Lab 4 - Peer Review Record

**Author:** Yohann Raphael Axel Moscato - 69540460011 - GitHub: @Yosko91
**Peer reviewer:** Heloise Savoye - 69540460018 - GitHub: @heloisesavoye

The branches are listed in the order they were merged into `lab4-staging`.

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Link | Reviewer verdict |
|----|--------|------|------------------|
| #49 | `feature/lab4-01-spec-and-test-plan` | https://github.com/Yosko91/toktickit/pull/49 |Very clear test plan. Looks good!|
| #50 | `feature/lab4-02-actions-taken-foundation` | https://github.com/Yosko91/toktickit/pull/50 | The code is clean. Good job.|
| #51 | `feature/lab4-03-actions-taken-ui` | https://github.com/Yosko91/toktickit/pull/51 |The workflow works perfectly! Just one question: where did you put the logic to update the ticket status? I didn't see it in the main controller. |
| #52 | `feature/lab4-04-ticket-workflow` | https://github.com/Yosko91/toktickit/pull/52 |Tested the workflow, it works perfectly. I confirm. |
| #53 | `feature/lab4-05-role-dashboards` | https://github.com/Yosko91/toktickit/pull/53 |Nice dashboards. Approved! |
| #54 | `feature/lab4-06-final-hardening` | https://github.com/Yosko91/toktickit/pull/54 |No bugs found. Everything is fine. |
| #55 | `lab4-staging` into `main` (release PR) | https://github.com/Yosko91/toktickit/pull/55 |Great project! |

**Review comment I received:**
The workflow works perfectly! Just one question: where did you put the logic to update the ticket status? I didn't see it in the main controller.

**How I responded:**
Thanks! The status change is not in the main tickets route, because only IT Staff can change a status. It is in server/src/routes/staffTickets.ts (PATCH /api/staff/tickets/:id/status). The rules are in server/src/services/ticketWorkflow.ts: the allowed transitions and the resolution gate. The new status and its Status History row are saved in one transaction, so they always match. No code change was needed.


## Pull Requests I reviewed for my partner

| PR | Repository / branch | Link | My verdict |
|----|---------------------|------|------------|
| # | | | |

**Comment I gave:**
<paste one comment I left on a Pull Request of my partner>

**My partner's response:**
<paste the answer>
