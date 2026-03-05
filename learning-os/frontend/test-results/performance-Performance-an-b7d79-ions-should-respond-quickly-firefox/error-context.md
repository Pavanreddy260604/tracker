# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e8]
    - heading "Welcome back" [level=1] [ref=e13]
    - paragraph [ref=e14]: Sign in to continue to Learning OS
  - generic [ref=e15]:
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: Email
        - generic [ref=e19]:
          - img [ref=e20]
          - textbox "you@example.com" [active] [ref=e23]
        - paragraph [ref=e24]: Invalid email address
      - generic [ref=e25]:
        - generic [ref=e26]: Password
        - generic [ref=e27]:
          - img [ref=e28]
          - textbox "Enter your password" [ref=e31]
        - paragraph [ref=e32]: Password is required
      - button "Sign In" [ref=e33]:
        - text: Sign In
        - img [ref=e34]
    - paragraph [ref=e38]:
      - text: Don't have an account?
      - link "Create account" [ref=e39] [cursor=pointer]:
        - /url: /register
  - paragraph [ref=e41]: Track • Learn • Grow
```