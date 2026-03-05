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
          - textbox "you@example.com" [ref=e23]
      - generic [ref=e24]:
        - generic [ref=e25]: Password
        - generic [ref=e26]:
          - img [ref=e27]
          - textbox "Enter your password" [ref=e30]
      - button "Sign In" [ref=e31]:
        - text: Sign In
        - img [ref=e32]
    - paragraph [ref=e36]:
      - text: Don't have an account?
      - link "Create account" [ref=e37] [cursor=pointer]:
        - /url: /register
  - paragraph [ref=e39]: Track • Learn • Grow
```