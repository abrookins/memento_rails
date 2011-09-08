class ChangeLatDataTypeToFloat < ActiveRecord::Migration
  def self.up
    change_table :memories do |t|
      t.change :lat, :float
    end
  end

  def self.down
    change_table :memories do |t|
      t.change :lat, :integer
    end
  end
end
