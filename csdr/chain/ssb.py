from csdr.chain import Chain
from csdr.chain.demodulator import Demodulator
from pycsdr.modules import RealPart, Agc, Convert
from pycsdr.types import Format


class Ssb(Demodulator):
    def __init__(self):
        workers = [
            RealPart(),
            # empty chain as placeholder for the "last decimation"
            Chain(),
            Agc(Format.FLOAT),
            Convert(Format.FLOAT, Format.SHORT),
        ]
        super().__init__(*workers)

    def setLastDecimation(self, decimation: Chain):
        self.replace(1, decimation)
