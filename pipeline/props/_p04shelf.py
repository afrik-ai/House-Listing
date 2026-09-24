import helpers as H, _p04kit as K
def build(W, D, Ht, levels=(0.04, 0.42, 0.82, 1.22, 1.62), frame=None):
    fr = frame or K.galvanized()
    deck = K.wood('chipboard', '#c4a57a', '#b39067', '#9c7a52', 0.85, seed=21, rings=80)
    t = 0.035
    for sx in (-1, 1):
        for sy in (-1, 1):
            x = sx * (W / 2 - t / 2); y = sy * (D / 2 - t / 2)
            # L-angle upright = two thin plates
            H.box('up_a', t, 0.0025, Ht, loc=(x, y + sy * (-t / 2 + 0.00125) * -1, Ht / 2), mat=fr)
            H.box('up_b', 0.0025, t, Ht, loc=(x + sx * (t / 2 - 0.00125), y, Ht / 2), mat=fr)
            # keyhole slots (dark insets) every 5 cm
    slot = K.painted('slot_dark', '#1a1a1a', 0.8)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x = sx * (W / 2 + 0.0015); y = sy * (D / 2 - t / 2)
            for i in range(int(Ht / 0.05)):
                H.box('slot', 0.001, 0.008, 0.018, loc=(x, y, 0.03 + i * 0.05), mat=slot)
    for z in levels + (Ht - 0.02,):
        for sy in (-1, 1):
            H.box('beam', W - 0.01, 0.03, 0.035, loc=(0, sy * (D / 2 - 0.02), z + 0.0175), mat=fr, bev=0.002, seg=1)
        for sx in (-1, 1):
            H.box('side', 0.03, D - 0.01, 0.025, loc=(sx * (W / 2 - 0.02), 0, z + 0.0125), mat=fr)
        d = H.box('deck', W - 0.05, D - 0.05, 0.016, loc=(0, 0, z + 0.035 - 0.008), mat=deck)
        H.uv_box(d, 1.0, along='x')
    for sx in (-1, 1):
        for sy in (-1, 1):
            H.cyl('foot', 0.022, 0.012, loc=(sx * (W / 2 - 0.018), sy * (D / 2 - 0.018), 0), seg=10, mat=K.rubber())
