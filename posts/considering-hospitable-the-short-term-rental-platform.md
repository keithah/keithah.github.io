---
title: 'Considering Hospitable, the Short Term Rental platform'
publishDate: '2025-08-22T01:39:02.677Z'
editDate: '2025-08-22T01:50:48.504Z'
uuid: F48D16C85FC84828845ECBBD3ECB119F
tags:
  - ai
  - dev
  - hack
  - personal
  - str
  - airbnb
images: []
location: null
weather: null
---
# Considering Hospitable, the Short Term Rental platform
#personal #airbnb #str #hack #dev #ai

I run a couple Airbnbs and using [Hostex](https://www.hostex.io/)  right now but they are lacking\.\. so looking at other options\.

[Hospitable](https://www.hospitable.com/)  looks interesting! So I got a trial\. They seem to have a decent API that is super important to me, but doesn’t look like many have built much with it\.

Before I can even consider switching, I need to make sure my integrations work\.

I have a [Unifi Access](https://ui.com/door-access)  gate system which isn’t supported by [Seam](https://seam.co/), what everyone uses for lock integration in this space, so I had to write my own, and then I use [Matrix](https://www.matrix.org/)  for message consolidation in a single app, so I need a bridge for that too\.

Since my Unifi Access setup is Python and Matrix bridge library I use is Go, I had to make Hospitable Libraries for both:

https://github/.com/keithah/hospitable/-python
https://github/.com/keithah/hospitable/-go

And then rewrote the integrations to be more flexible than the original ones:
https://github/.com/keithah/unifi/-access/-pms
https://github/.com/keithah/matrix/-hospitable/-bridge

\(I also wrote a [unifi\-access python library](https://github.com/keithah/unifi-access-python) too\)

I’ll do a bigger review of Hospitable later, but at a glance it doesn’t seem to do much more than my existing one, Hostex, at almost 3x the cost, but its fun building integrations!

I’ll probably rewrite my hostex stuff to use the new projects, since they’re now written to be much more modular\.

If I do go with it, I’ll write an MCP for it as well\.
