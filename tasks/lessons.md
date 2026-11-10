# Lessons
- Competition idea pick: survey existing public entries FIRST (gh search repos by contest name, sponsor model names, hashtags) before ranking ideas. Evidence of pain is not enough; uniqueness within the field decides. (User redirected after I picked an OPD intake idea that 9 entries already cover.)
- Verify contest scope rules on the official FAQ before designing architecture (Agent Builder was out of scope; synthetic data only).
- Never rebuild Next (`next build`) under a running `next start`: the old server serves new HTML with missing chunks (400s, no hydration). Restart the server after each build, killing it by port, not with `pkill -f` on a pattern that also matches the shell running the command.
